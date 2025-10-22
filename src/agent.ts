import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  metrics,
  voice,
} from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { searchKnowledge, getAllKnowledge } from './database/store.js';
import { escalateToSupervisor } from './services/escalation.js';
import { sessionManager } from './services/session-manager.js';

dotenv.config({ path: '.env.local' });

class Assistant extends voice.Agent {
  private customerPhone: string;

  constructor(customerPhone: string = '+1234567890') {
    super({
      instructions: `You are the AI receptionist for Glamour Salon, a premium hair salon.
      
Your role is to:
- Answer questions about the salon's services, hours, location, and pricing
- Be friendly, professional, and helpful
- Keep responses conversational and concise
- Never use emojis, asterisks, or complex formatting in your speech

KNOWLEDGE BASE USAGE:
- ALWAYS search the knowledge base first before escalating
- Use your reasoning: if you know "pets allowed", then dogs/cats/parrots are ALL allowed
- Generalize answers intelligently: "pets" includes dogs, cats, birds, etc.
- Only escalate if you truly have no related information

WHEN TO ESCALATE:
1. DO NOT make up information or guess
2. Use "requestHelp" ONLY if the knowledge base has no relevant answer
3. If you have related info (e.g., "pets allowed" for "parrots"), USE IT
4. Tell customer: "Let me check with my supervisor"

The user is interacting with you via voice, even if you perceive the conversation as text.`,

      tools: {
        searchKnowledge: llm.tool({
          description: `Search the salon's knowledge base for information about services, hours, pricing, location, etc.
          
Use this tool when the customer asks about specific information about the salon.

If no relevant information is found, AUTOMATICALLY escalate to the supervisor and return a confirmation message to the caller.`,
          parameters: z.object({
            query: z.string().describe('The question or topic to search for in the knowledge base'),
          }),
          execute: async ({ query }) => {
            console.log(`[Knowledge Search] Query: "${query}"`);
            const result = await searchKnowledge(query);
            
            if (result) {
              console.log(`[Knowledge Search] Found answer: "${result.answer}"`);
              return result.answer;
            }
            
            console.log(`[Knowledge Search] No answer found`);
            // Auto-escalate when the KB has no answer
            const requestId = await escalateToSupervisor({
              customerPhone: this.customerPhone,
              question: query,
            });
            return `I couldn't find that in my records, so I've escalated your question to my supervisor. You'll hear back shortly. Reference: ${requestId}.`;
          },
        }),
        
        requestHelp: llm.tool({
          description: `Escalate a question to your human supervisor when you don't know the answer.
          
Use this tool when:
- You cannot find information in the knowledge base
- The customer asks something you're unsure about
- The question requires human judgment or decision-making

After using this tool, tell the customer: "Let me check with my supervisor and get back to you."`,
          parameters: z.object({
            question: z.string().describe('The question you need help answering'),
          }),
          execute: async ({ question }) => {
            console.log(`[Request Help] Escalating: "${question}"`);
            
            const requestId = await escalateToSupervisor({
              customerPhone: this.customerPhone,
              question,
            });
            
            return `I've sent your question to my supervisor. They'll get back to you shortly with an answer. Your reference number is ${requestId}.`;
          },
        }),
      },
    });
    
    this.customerPhone = customerPhone;
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
    
    // Log available knowledge on startup
    const knowledge = await getAllKnowledge();
    console.log(`[Agent] Loaded ${knowledge.length} knowledge base entries`);
  },
  entry: async (ctx: JobContext) => {
    // Extract customer phone from room metadata (in production, this would come from SIP or room metadata)
    const customerPhone = ctx.room.metadata ? 
      JSON.parse(ctx.room.metadata).customerPhone : 
      '+1234567890'; 
    const sttModel = process.env.STT_MODEL || 'assemblyai/universal-streaming:en';
    const ttsModel = process.env.TTS_MODEL || 'cartesia/sonic-2:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc';
    console.log(`[Agent] Using STT=${sttModel}, TTS=${ttsModel}`);

    const session = new voice.AgentSession({
      // Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
      // See all available models at https://docs.livekit.io/agents/models/stt/
      stt: sttModel,

      // A Large Language Model (LLM) is your agent's brain, processing user input and generating a response
      // See all providers at https://docs.livekit.io/agents/models/llm/
      llm: 'openai/gpt-4.1-mini',

      // Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
      // See all available models as well as voice selections at https://docs.livekit.io/agents/models/tts/
      tts: ttsModel,

      // VAD and turn detection are used to determine when the user is speaking and when the agent should respond
      // See more at https://docs.livekit.io/agents/build/turns
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad! as silero.VAD,
    });


    // Metrics collection, to measure pipeline performance
    // For more information, see https://docs.livekit.io/agents/build/metrics/
    const usageCollector = new metrics.UsageCollector();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      try {
        metrics.logMetrics(ev.metrics);
        usageCollector.collect(ev.metrics);
      } catch (error) {
        console.warn('[Metrics] Failed to collect metrics:', error);
      }
    });

    const logUsage = async () => {
      try {
        const summary = usageCollector.getSummary();
        console.log(`Usage: ${JSON.stringify(summary)}`);
      } catch (error) {
        console.warn('[Metrics] Failed to log usage summary:', error);
      }
    };

    ctx.addShutdownCallback(logUsage);
    
    // Listen for session close events to unregister only when customer disconnects
    session.on(voice.AgentSessionEventTypes.Close, () => {
      try {
        console.log(`[SessionManager] Session closed for ${customerPhone}, unregistering`);
        sessionManager.unregisterSession(customerPhone);
      } catch (error) {
        console.warn('[SessionManager] Failed to unregister session:', error);
      }
    });

    // Start the session, which initializes the voice pipeline and warms up the models
    try {
      await session.start({
        agent: new Assistant(customerPhone),
        room: ctx.room,
        inputOptions: {
          noiseCancellation: BackgroundVoiceCancellation(),
        },
      });

      // Join the room and connect to the user
      await ctx.connect();
      
      // Register this session for live follow-ups
      sessionManager.registerSession(customerPhone, session, ctx.room.name || 'unknown');
      
      // Generate initial greeting using generateReply to ensure session is ready
      session.generateReply({
        instructions: "Greet the customer warmly and ask how you can help them today. Keep it brief and friendly."
      });
    } catch (error) {
      console.error('[Agent] Failed to start session:', error);
      throw error; 
    }
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
