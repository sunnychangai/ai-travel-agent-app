// Version History Service
// Reads and parses the version-history.md file

export interface VersionEntry {
  version: string;
  date: string;
  features: string[];
  bugFixes: string[];
  improvements: string[];
  architectureOverhaul: string[];
  technicalDebtReduction: string[];
  systemArchitecture: string[];
}

export const versionHistoryService = {
  /**
   * Fetch and parse the version history from the markdown file
   */
  async getVersionHistory(): Promise<VersionEntry[]> {
    try {
      // In development, we'll use a static import
      // In production, you might want to fetch this from a CDN or API
      const response = await fetch('/version-history.md');
      const text = await response.text();
      
      return this.parseVersionHistory(text);
    } catch (error) {
      console.error('Error loading version history:', error);
      // Return fallback data if file can't be loaded
      return this.getFallbackVersionHistory();
    }
  },

  /**
   * Parse markdown content into structured version data
   */
  parseVersionHistory(markdown: string): VersionEntry[] {
    const versions: VersionEntry[] = [];
    const lines = markdown.split('\n');
    
    let currentVersion: Partial<VersionEntry> | null = null;
    let currentSection: 'features' | 'bugFixes' | 'improvements' | 'architectureOverhaul' | 'technicalDebtReduction' | 'systemArchitecture' | null = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Version header: ## Version X.X.X - Date
      if (trimmedLine.startsWith('## Version ')) {
        // Save previous version if exists
        if (currentVersion && currentVersion.version) {
          versions.push(currentVersion as VersionEntry);
        }
        
        // Parse version and date
        const versionMatch = trimmedLine.match(/## Version (.+?) - (.+)/);
        if (versionMatch) {
          currentVersion = {
            version: versionMatch[1],
            date: versionMatch[2],
            features: [],
            bugFixes: [],
            improvements: [],
            architectureOverhaul: [],
            technicalDebtReduction: [],
            systemArchitecture: []
          };
          currentSection = null;
        }
      }
      
      // Section headers - more flexible matching
      else if (trimmedLine.includes('✨') && (trimmedLine.includes('New Features') || trimmedLine.includes('Features') || trimmedLine.includes('Initial Release'))) {
        currentSection = 'features';
      }
      else if (trimmedLine.includes('🐛') && (trimmedLine.includes('Bug Fixes') || trimmedLine.includes('Fixes') || trimmedLine.includes('Critical Bug Fixes'))) {
        currentSection = 'bugFixes';
      }
      else if (trimmedLine.includes('🔧') && trimmedLine.includes('Technical Debt Reduction')) {
        currentSection = 'technicalDebtReduction';
      }
      else if (trimmedLine.includes('🔧') && (trimmedLine.includes('Improvements') || trimmedLine.includes('Changes') || trimmedLine.includes('Major Improvements'))) {
        currentSection = 'improvements';
      }
      else if (trimmedLine.includes('🎯') && (trimmedLine.includes('Major Architecture Overhaul') || trimmedLine.includes('Architecture Overhaul'))) {
        currentSection = 'architectureOverhaul';
      }
      else if (trimmedLine.includes('📊') && (trimmedLine.includes('System Architecture'))) {
        currentSection = 'systemArchitecture';
      }
      
      // Bullet points
      else if (trimmedLine.startsWith('- ') && currentVersion && currentSection) {
        const content = trimmedLine.substring(2); // Remove "- "
        currentVersion[currentSection]?.push(content);
      }
      
      // Stop at separator or end of versions
      else if (trimmedLine === '---' || trimmedLine.startsWith('## How to Update')) {
        if (currentVersion && currentVersion.version) {
          versions.push(currentVersion as VersionEntry);
          currentVersion = null;
        }
      }
    }
    
    // Add last version if exists
    if (currentVersion && currentVersion.version) {
      versions.push(currentVersion as VersionEntry);
    }
    
    return versions;
  },

  /**
   * Fallback version history if file can't be loaded
   */
  getFallbackVersionHistory(): VersionEntry[] {
    return [
      {
        version: "2.1.0",
        date: "December 1, 2024",
        features: [
          "**Beta Feedback System**: Added comprehensive feedback collection for beta users",
          "Mobile: Third tab in bottom navigation",
          "Desktop: Feedback button in header with modal"
        ],
        bugFixes: [
          "Fixed feedback database permissions and RLS policies",
          "Resolved submit button visibility issues on mobile"
        ],
        improvements: [
          "Enhanced form validation and error handling",
          "Better responsive design for feedback interface"
        ],
        architectureOverhaul: [],
        technicalDebtReduction: [],
        systemArchitecture: []
      },
      {
        version: "2.0.0",
        date: "November 25, 2024",
        features: [
          "**Intent Recognition System**: Added AI-powered intent classification for chat queries",
          "**Enhanced Context Tracking**: Improved conversation context management"
        ],
        bugFixes: [],
        improvements: [
          "Better differentiation between various user request types",
          "Enhanced AI response accuracy and relevance"
        ],
        architectureOverhaul: [],
        technicalDebtReduction: [],
        systemArchitecture: []
      }
    ];
  }
}; 