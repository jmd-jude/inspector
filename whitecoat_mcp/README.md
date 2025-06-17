# Whitecoat

Transform expert pre-med guidance into an interactive AI consultation system.

## What This Does

This MCP server turns pre-med counseling expertise into a living, interactive experience with:

- **Smart Prompts**: Personalized guidance for school selection, timelines, interviews, and gap years
- **Rich Resources**: Access to AAMC guidelines and expert counseling strategies
- **Helpful Tools**: Find relevant guidance and match schools to your profile
- **Personal Guidance**: Get specific advice for your unique pre-med journey

## Features

### Interactive Prompts
- **School Selection Strategy**: Create personalized medical school application lists
- **Application Timeline**: Month-by-month planning for your application cycle
- **Interview Prep**: Targeted preparation for different interview formats
- **Gap Year Planning**: Strategic planning to strengthen your application

### Knowledge Resources
- AAMC Official Pre-Med Guide (comprehensive admissions guidance)
- Pre-Med Counseling Playbook (expert strategies and frameworks)

### Smart Tools
- Find guidance relevant to your specific situation
- Match your profile to appropriate medical schools

## Quick Start

1. Run the install script: `./install.sh`
2. Add to Claude Desktop (see configuration below)
3. Start getting personalized pre-med guidance!

## Claude Desktop Configuration

Add this to your Claude Desktop config file:

**Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "premed-counseling-assistant": {
      "command": "node",
      "args": ["/path/to/premed-assistant/src/index.js"]
    }
  }
}
```

Replace `/path/to/premed-assistant` with the actual path to your project folder.

## Example Usage

Once connected to Claude Desktop, try:

1. **"Use the school-selection-strategy prompt with my 3.6 GPA and 510 MCAT score"** - Get personalized school recommendations
2. **"Show me the AAMC guide resource"** - Access official admissions guidance
3. **"Find guidance relevant to MCAT preparation"** - Get targeted study advice
4. **"Use the interview-prep prompt for my MMI at University of Michigan"** - Practice interview scenarios

## The Vision

This demonstrates how expert counseling can become interactive, personalized guidance. Instead of reading generic advice, students get:

- ✅ Specific recommendations for their profile
- ✅ Step-by-step planning frameworks
- ✅ Situation-specific strategies
- ✅ Always-available expert consultation

## Business Model Potential

This same approach could transform any counseling practice:
- 📈 Recurring revenue vs. one-time consultations
- 🔄 Scalable expertise delivery
- 🎯 Personalized guidance at scale
- 💡 Interactive consultation system

## File Structure

```
premed-assistant/
├── src/
│   └── index.js          # Main MCP server (150 lines vs 1000+)
├── resources/
│   ├── aamc_guide.md     # AAMC official guidance
│   └── premed_playbook.txt # Expert counseling strategies
├── package.json
├── install.sh
└── README.md
```

## Technical Notes

Built using the Model Context Protocol (MCP) with:
- **Resources** for rich content access from expert files
- **Prompts** for guided, personalized interactions  
- **Tools** for dynamic assistance and matching
- **File-based content** for easy updates and customization

This is a proof-of-concept for transforming any expert's knowledge into an interactive AI consultation system.

## Setup Instructions

### Prerequisites
- Node.js installed on your system
- Claude Desktop application

### Installation
1. Clone or download this project folder
2. Open Terminal and navigate to the project directory
3. Run: `chmod +x install.sh`
4. Run: `./install.sh`
5. Configure Claude Desktop with the server path
6. Restart Claude Desktop
7. Start getting personalized pre-med guidance!

## Testing the System

Ask Claude:
- "What MCP servers are available?" (should show premed-counseling-assistant)
- "Show me the pre-med counseling playbook resource"
- "Use the school-selection-strategy prompt for a student with 3.7 GPA"
- "Find guidance relevant to gap year planning"

---

*This system demonstrates the future of expert knowledge delivery - interactive, personalized, and always available.*