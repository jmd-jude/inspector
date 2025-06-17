// src/index.js
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

console.error("🚀 Whitecoat Pre-Med Counseling Assistant starting...");

class PreMedCounselingAssistant {
  constructor() {
    this.server = new Server(
      {
        name: "whitecoat",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          prompts: {},
          tools: {},
        },
      }
    );

    this.prompts = new Map(); // Cache for loaded prompts
    this.setupHandlers();
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async loadPrompts() {
    const promptsDir = path.join(path.dirname(process.argv[1]), '..', 'prompts');
    try {
      const files = await fs.readdir(promptsDir);
      const yamlFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
      
      for (const file of yamlFiles) {
        const filePath = path.join(promptsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const promptConfig = yaml.load(content);
        this.prompts.set(promptConfig.name, promptConfig);
      }
      console.error(`✅ Loaded ${this.prompts.size} prompts from files`);
    } catch (error) {
      console.error("❌ Error loading prompts:", error.message);
    }
  }

  renderTemplate(template, args) {
    // Simple template rendering - replace {{variable}} with values
    let rendered = template;
    for (const [key, value] of Object.entries(args)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, value || '');
    }
    
    // Handle conditional rendering like {{variable || "default"}}
    rendered = rendered.replace(/{{(\w+)\s*\|\|\s*"([^"]*)"}}/, (match, varName, defaultValue) => {
      return args[varName] || defaultValue;
    });
    
    return rendered;
  }

  setupHandlers() {
    // Resources Handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "premed://guide/aamc-guide",
          name: "AAMC Official Pre-Med Guide",
          description: "Comprehensive guide to medical school admissions process",
          mimeType: "text/markdown",
        },
        {
          uri: "premed://playbook/counseling-playbook",
          name: "Pre-Med Counseling Playbook",
          description: "Expert strategies and frameworks for pre-med success",
          mimeType: "text/plain",
        }
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      try {
        let filePath;
        switch (uri) {
          case "premed://guide/aamc-guide":
            filePath = path.join(path.dirname(process.argv[1]), '..', 'resources', 'aamc_guide.md');
            break;
          case "premed://playbook/counseling-playbook":
            filePath = path.join(path.dirname(process.argv[1]), '..', 'resources', 'premed_playbook.txt');
            break;
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }

        const content = await fs.readFile(filePath, 'utf8');
        return {
          contents: [
            {
              uri,
              mimeType: uri.includes('aamc-guide') ? "text/markdown" : "text/plain",
              text: content,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to read resource ${uri}: ${error.message}`);
      }
    });

    // Prompts Handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      await this.loadPrompts(); // Reload prompts each time (allows for live editing)
      
      const promptList = Array.from(this.prompts.values()).map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments || []
      }));
      
      return { prompts: promptList };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      await this.loadPrompts(); // Ensure prompts are loaded
      const promptConfig = this.prompts.get(name);
      
      if (!promptConfig) {
        throw new Error(`Unknown prompt: ${name}`);
      }
      
      const renderedText = this.renderTemplate(promptConfig.template, args);
      
      return {
        description: promptConfig.description,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: renderedText,
            },
          },
        ],
      };
    });

    // Tools Handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "find-relevant-guidance",
          description: "Find specific guidance from pre-med counseling resources",
          inputSchema: {
            type: "object",
            properties: {
              topic: {
                type: "string",
                description: "The topic you need guidance on (e.g., MCAT prep, research, volunteering)",
              },
              student_situation: {
                type: "string",
                description: "Brief description of the student's current situation",
              }
            },
            required: ["topic"],
          },
        },
        {
          name: "school-matcher",
          description: "Match student profile to appropriate medical schools",
          inputSchema: {
            type: "object",
            properties: {
              gpa: {
                type: "number",
                description: "Student's GPA",
              },
              mcat: {
                type: "number", 
                description: "Student's MCAT score",
              },
              state: {
                type: "string",
                description: "State of residency",
              },
              preferences: {
                type: "string",
                description: "Any specific preferences (location, program type, etc.)",
              }
            },
            required: ["gpa", "mcat", "state"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "find-relevant-guidance":
          return {
            content: [
              {
                type: "text",
                text: await this.findGuidance(args.topic, args.student_situation),
              },
            ],
          };

        case "school-matcher":
          return {
            content: [
              {
                type: "text", 
                text: await this.matchSchools(args.gpa, args.mcat, args.state, args.preferences),
              },
            ],
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  // Tool implementations
  
  async findGuidance(topic, studentSituation = "") {
    // Map topics to comprehensive guidance frameworks
    const guidanceFrameworks = {
      
      // School Selection Strategy
      'school selection': this.getSchoolSelectionGuidance(studentSituation),
      'school list': this.getSchoolSelectionGuidance(studentSituation),
      'medical school applications': this.getSchoolSelectionGuidance(studentSituation),
      
      // MCAT Strategy
      'mcat': this.getMCATGuidance(studentSituation),
      'mcat prep': this.getMCATGuidance(studentSituation),
      'mcat strategy': this.getMCATGuidance(studentSituation),
      
      // Application Timeline
      'timeline': this.getTimelineGuidance(studentSituation),
      'application timeline': this.getTimelineGuidance(studentSituation),
      'planning': this.getTimelineGuidance(studentSituation),
      
      // Personal Statement
      'personal statement': this.getPersonalStatementGuidance(studentSituation),
      'essay': this.getPersonalStatementGuidance(studentSituation),
      'writing': this.getPersonalStatementGuidance(studentSituation),
      
      // Interview Prep
      'interview': this.getInterviewGuidance(studentSituation),
      'interview prep': this.getInterviewGuidance(studentSituation),
      'mmi': this.getInterviewGuidance(studentSituation),
      
      // Gap Year Planning
      'gap year': this.getGapYearGuidance(studentSituation),
      'gap year planning': this.getGapYearGuidance(studentSituation),
      
      // Activity Descriptions
      'activities': this.getActivityGuidance(studentSituation),
      'activity descriptions': this.getActivityGuidance(studentSituation),
      'experiences': this.getActivityGuidance(studentSituation),
      
      // Low Stats Strategy
      'low gpa': this.getLowStatsGuidance(studentSituation),
      'low mcat': this.getLowStatsGuidance(studentSituation),
      'low stats': this.getLowStatsGuidance(studentSituation),
    };

    // Find matching guidance
    const topicLower = topic.toLowerCase();
    let guidanceContent = null;
    
    for (const [key, content] of Object.entries(guidanceFrameworks)) {
      if (topicLower.includes(key)) {
        guidanceContent = content;
        break;
      }
    }
    
    // Default comprehensive guidance if no specific match
    if (!guidanceContent) {
      guidanceContent = this.getComprehensiveGuidance(topic, studentSituation);
    }
    
    return guidanceContent;
  }

  // Add these helper methods after your existing matchSchools method:

  getSchoolSelectionGuidance(situation) {
    return `# 🎯 **Strategic Medical School Application Planning**

## 📊 **Your Situation Analysis**
${situation ? `**Current Status:** ${situation}` : '**Status:** Ready for strategic school selection planning'}

## 🏫 **School Selection Framework**

### **📈 Create Your School Categories**
- **Reach Schools (3-5):** Target schools above your stats range
- **Target Schools (8-12):** Schools matching your profile well  
- **Safety Schools (3-5):** Very likely acceptances

### **🎯 Key Selection Factors**
- **Stats Alignment:** GPA/MCAT fit with school averages
- **Mission Fit:** How your background aligns with school values
- **State Residency:** Maximize in-state advantages
- **Program Strengths:** Research, clinical focus, specialty interests

## ✅ **Next Action Steps**
- [ ] Gather your stats (GPA, MCAT, state residency)
- [ ] Research 30+ schools initially
- [ ] Narrow to 15-20 strategic applications
- [ ] Use school-matcher tool for specific recommendations

**💡 Ready for specific school recommendations?** Use the school-matcher tool with your GPA, MCAT, and state for personalized lists!

*Framework based on proven admissions strategies and current MSAR data.*`;
  }

  getMCATGuidance(situation) {
    return `# 📚 **MCAT Strategy & Preparation Framework**

## 🎯 **Your MCAT Profile**
${situation ? `**Current Status:** ${situation}` : '**Status:** Ready for MCAT strategic planning'}

## 📊 **Strategic MCAT Planning**

### **🎯 Score Target Setting**
- **Research Target Schools:** What scores do you need?
- **Realistic Assessment:** Is your timeline sufficient?
- **Backup Planning:** Contingencies if scores disappoint

### **📅 Preparation Timeline**
- **4-6 Months:** Recommended minimum preparation time
- **Content Review:** 2-3 months systematic review
- **Practice Phase:** 1-2 months intensive practice tests
- **Final Prep:** 2-4 weeks review and confidence building

### **📚 Study Strategy Framework**
- **Content Mastery:** High-yield topics by section
- **Practice Integration:** Weekly full-length exams
- **Weak Area Focus:** Data-driven improvement targeting
- **Test-Day Strategy:** Timing, stamina, and confidence

## ✅ **Next Action Steps**
- [ ] Set target score based on school research
- [ ] Create detailed study schedule
- [ ] Select prep materials and resources
- [ ] Schedule practice test dates

**💡 Need timeline coordination?** Search for "application timeline" guidance to align MCAT with your application schedule!

*Strategy based on high-scoring student approaches and proven prep methods.*`;
  }

  getTimelineGuidance(situation) {
    return `# 📅 **Medical School Application Timeline Strategy**

## 🎯 **Your Timeline Profile**
${situation ? `**Current Status:** ${situation}` : '**Status:** Ready for comprehensive timeline planning'}

## 📊 **Strategic Timeline Framework**

### **🚨 Critical Deadlines (Cannot Miss)**
- **AMCAS Submission:** June 1st for early verification
- **MCAT Registration:** 1-2 months before test date
- **Letters of Rec:** Request 3-4 months in advance
- **Secondary Deadlines:** 2-4 weeks after receipt

### **📅 Month-by-Month Breakdown**

**January-April (Pre-Application):**
- [ ] Complete prerequisites and research
- [ ] MCAT preparation and testing
- [ ] Secure research/clinical positions

**May-August (Application Season):**
- [ ] Submit primary applications early
- [ ] Complete secondary applications quickly
- [ ] Finalize letters of recommendation

**September-April (Interview Season):**
- [ ] Interview preparation and attendance
- [ ] Send meaningful updates
- [ ] Make final school decisions

## ✅ **Next Action Steps**
- [ ] Identify your current stage
- [ ] Create personalized calendar with deadlines
- [ ] Set up tracking system for requirements
- [ ] Begin work on most urgent items

**💡 Need MCAT timing help?** Search for "MCAT strategy" to coordinate test dates with your application timeline!

*Timeline based on successful application cycles and AAMC recommendations.*`;
  }

  getPersonalStatementGuidance(situation) {
    return `# ✍️ **Personal Statement Excellence Framework**

## 🎯 **Your Writing Profile**
${situation ? `**Current Status:** ${situation}` : '**Status:** Ready to craft compelling personal narrative'}

## 🏗️ **Personal Statement Architecture**

### **🎬 The "Show Don't Tell" Framework**
**❌ Avoid:** "I've always wanted to be a doctor and I'm passionate about helping people."
**✅ Do:** "When Mrs. Chen gripped my hand and whispered 'thank you for seeing me,' I understood that medicine wasn't just about diagnosis—it was about human connection."

### **📝 Paragraph Structure**
- **Opening Hook:** Compelling scene that establishes your theme
- **Experience Evidence:** Specific stories showing growth and insight
- **Personal Reflection:** Self-awareness and lessons learned
- **Future Vision:** How you'll contribute to medicine

### **✨ Expert Writing Techniques**
- **Specificity Over Generality:** Concrete details vs. abstract claims
- **Active Voice Power:** Dynamic, engaging writing style
- **Emotional Resonance:** Connect with readers' humanity

## ✅ **Next Action Steps**
- [ ] Identify your most compelling motivation story
- [ ] Outline 4-paragraph structure
- [ ] Write first draft focusing on content
- [ ] Revise using "show don't tell" principles

**💡 Need activity descriptions?** Search for "activity descriptions" to enhance your experience narratives!

*Framework based on successful personal statements and admissions committee feedback.*`;
  }

  getInterviewGuidance(situation) {
    return `# 🎯 **Medical School Interview Mastery**

## 🎯 **Your Interview Profile**
${situation ? `**Current Status:** ${situation}` : '**Status:** Ready for interview preparation excellence'}

## 🎭 **Interview Success Framework**

### **📚 Essential Story Arsenal (Prepare These First)**
- **Clinical Experience Story:** Patient interaction and medical commitment
- **Research/Academic Achievement:** Intellectual curiosity and scientific thinking
- **Leadership Challenge:** Collaboration and problem-solving skills
- **Personal Growth:** Resilience, self-awareness, and maturity
- **Service Impact:** Community commitment and understanding

### **❓ High-Probability Questions**
- **"Why Medicine?"** (100% probability)
- **"Why Our School?"** (100% probability)  
- **"Tell Me About Yourself"** (90% probability)
- **Ethical scenarios and teamwork challenges**

### **🎯 Format-Specific Strategies**
- **MMI:** Quick thinking, clear communication, multiple scenarios
- **Traditional:** Conversational flow, detailed storytelling
- **Panel:** Eye contact distribution, handling multiple questioners

## ✅ **Next Action Steps**
- [ ] Develop 5 core stories using STAR method
- [ ] Research specific school mission and values
- [ ] Practice with mock interviews
- [ ] Prepare thoughtful questions for interviewers

**💡 Need school research?** Use school-matcher tool to understand specific program strengths and values!

*Strategy based on successful interview experiences and admissions committee insights.*`;
  }

  getGapYearGuidance(situation) {
    return `# 🚀 **Strategic Gap Year Planning**

## 🎯 **Your Gap Year Profile**
${situation ? `**Current Status:** ${situation}` : '**Status:** Ready for transformative gap year planning'}

## 💪 **Gap Year Success Framework**

### **🎯 High-Impact Activity Categories**
- **Clinical Experience:** Medical scribe, CNA, research coordinator
- **Research Excellence:** Full-time lab position, independent projects
- **Academic Enhancement:** Post-bac programs, additional coursework
- **Service Leadership:** AmeriCorps, community health initiatives

### **📅 Strategic Timeline**
- **Months 1-3:** Foundation building and routine establishment
- **Months 4-8:** Skill development and increasing responsibility
- **Months 9-12:** Application preparation and relationship building

### **💰 Financial Strategy**
- **Paid Positions:** Medical scribe ($15-20/hr), CNA ($16-22/hr)
- **Funded Programs:** AmeriCorps, Peace Corps with stipends
- **Cost-Benefit Analysis:** High-impact vs. budget considerations

## ✅ **Next Action Steps**
- [ ] Identify your biggest application weaknesses
- [ ] Research high-impact opportunities in your area
- [ ] Create budget and financial plan
- [ ] Apply for primary gap year positions

**💡 Need weakness assessment?** Search for "low stats strategy" if academic concerns, or "school selection" for profile evaluation!

*Strategy based on successful gap year outcomes and admissions preferences.*`;
  }

  getActivityGuidance(situation) {
    return `# ✨ **Transform Activities Into Compelling Stories**

## 🎯 **Your Activity Profile**
${situation ? `**Current Status:** ${situation}` : '**Status:** Ready to optimize activity descriptions'}

## 🎨 **The Transformation Framework**

### **❌ BEFORE (Generic Job Description)**
"I tutored students in chemistry and helped them with homework."

### **✅ AFTER (Compelling Impact Story)**
"When Charlie, a 45-year-old veteran, announced 'I changed my major to chemistry!' I realized I hadn't just taught formulas—I'd helped someone discover their passion."

### **🔍 Find Your "Charlie" Moment**
- **Who was impacted?** Specific person who benefited
- **What was the turning point?** When you realized your impact
- **How did YOU grow?** Skills and insights you developed

### **📝 Character Limit Mastery**
- **AMCAS (700 characters):** One powerful moment with reflection
- **Most Meaningful (1,325):** Extended story with deeper insight
- **Show vs. Tell:** Concrete scenes, not abstract statements

## ✅ **Next Action Steps**
- [ ] Identify most impactful moment from each activity
- [ ] Add specific people, dialogue, and details
- [ ] Transform using "show don't tell" principles
- [ ] Test for memorability and uniqueness

**💡 Need personal statement help?** Search for "personal statement" to weave these stories into your main narrative!

*Transformation strategy based on successful applications and admissions feedback.*`;
  }

  getLowStatsGuidance(situation) {
    return `# 💪 **Maximize Your Chances Despite Lower Stats**

## 🎯 **Your Profile Assessment**
${situation ? `**Current Status:** ${situation}` : '**Status:** Ready for strategic compensation planning'}

## 🎯 **Strategic Compensation Framework**

### **🏆 The "Holistic Review" Advantage**
Your stats are just ONE part of the equation. Here's how to maximize other components:
- **Transform challenges into strength narratives**
- **Leverage unique experiences numbers can't capture**
- **Demonstrate exceptional commitment despite obstacles**

### **🏫 Smart School Selection**
- **DO Schools:** Often more holistic admissions approach
- **State Schools:** Maximize in-state residency advantage
- **Mission-Driven Schools:** Value service and unique perspectives
- **Apply Broadly:** 20-25 schools vs. typical 15-20

### **📝 Application Compensation Tactics**
- **Address stats honestly but briefly** in personal statement
- **Focus on growth and current capabilities**
- **Show evidence of medical school readiness**
- **Amplify strengths in other areas**

## ✅ **Next Action Steps**
- [ ] Identify your strongest non-academic assets
- [ ] Research schools known for holistic review
- [ ] Craft narrative around growth and resilience
- [ ] Consider gap year if significant improvement needed

**💡 Need school recommendations?** Use school-matcher tool with your actual stats for realistic target lists!

*Strategy based on successful non-traditional applicants and holistic admissions practices.*`;
  }

  getComprehensiveGuidance(topic, situation) {
    return `# 🎯 **Comprehensive Pre-Med Guidance**

## 📊 **Topic Focus: ${topic}**
${situation ? `**Your Situation:** ${situation}` : '**Status:** Ready for expert pre-med guidance'}

Based on pre-med counseling resources and AAMC guidelines, here's strategic guidance for your situation:

## 🚀 **Available Expert Guidance Areas**

### **📚 Strategic Planning**
- **School Selection:** Building your optimal application list
- **Timeline Management:** Month-by-month planning framework
- **MCAT Strategy:** Comprehensive preparation roadmap

### **✍️ Application Excellence**
- **Personal Statement:** Compelling narrative framework
- **Activity Optimization:** Transform experiences into stories
- **Interview Mastery:** Format-specific preparation strategies

### **💪 Challenge Navigation**
- **Gap Year Planning:** Strategic strengthening activities
- **Low Stats Strategy:** Maximize chances with compensation tactics
- **Weakness Assessment:** Identify and address application gaps

## ✅ **Next Steps for ${topic}**
- [ ] Search for more specific guidance using exact topic keywords
- [ ] Use school-matcher tool for personalized recommendations
- [ ] Access AAMC guide and counseling playbook resources
- [ ] Consider which area needs your immediate attention

**💡 For more targeted help:** Try searching for specific topics like "MCAT strategy," "school selection," "personal statement," "interview prep," "gap year planning," or "low stats strategy."

*Guidance based on proven counseling frameworks and current admissions best practices.*`;
  }

  async matchSchools(gpa, mcat, state, preferences = "") {
    return `# Medical School Matching Analysis

**Your Profile:**
- GPA: ${gpa}
- MCAT: ${mcat}  
- State: ${state}
- Preferences: ${preferences}

## School Categories:

### Reach Schools (Apply to 3-5)
Based on your stats, these schools would be ambitious but possible targets.

### Target Schools (Apply to 8-12)  
These schools align well with your profile and represent your best chances.

### Safety Schools (Apply to 3-5)
These schools should be very likely acceptances based on your stats.

## State-Specific Advantages:
Recommendations for maximizing your in-state opportunities in ${state}.

*Note: This tool would integrate with current MSAR data and school-specific requirements from the counseling resources to provide detailed, data-driven recommendations.*

## Strategic Recommendations:
- Total recommended applications: 15-20 schools
- Focus areas for your profile
- Timeline considerations for your application strategy

Would you like more detailed information about any specific schools or categories?`;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Pre-Med Counseling Assistant MCP server running on stdio");
    
    // Auto-display welcome message
    setTimeout(async () => {
      try {
        await this.loadPrompts();
        const welcomePrompt = this.prompts.get('welcome');
        if (welcomePrompt) {
          const welcomeMessage = this.renderTemplate(welcomePrompt.template, {
            student_name: '',
            current_stage: ''
          });
          console.error("\n" + "=".repeat(80));
          console.error("🩺 WHITECOAT PRE-MED COUNSELING ASSISTANT");
          console.error("=".repeat(80));
          console.error(welcomeMessage);
          console.error("=".repeat(80));
          console.error("💡 To use any prompt, tell Claude: 'Use the [prompt-name] prompt with [your details]'");
          console.error("=".repeat(80) + "\n");
        }
      } catch (error) {
        console.error("Welcome message error:", error.message);
      }
    }, 1000); // 1 second delay to ensure connection is established
  }
}

console.error("✅ All imports successful");

const server = new PreMedCounselingAssistant();
server.run().catch(console.error);