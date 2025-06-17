export interface ExpoDocument {
  id: string;
  url: string;
  title: string;
  content: string;
  markdown: string;
  frontmatter: Record<string, any>;
  type: 'guide' | 'api' | 'tutorial' | 'reference';
  lastModified: Date;
  platforms: Array<'ios' | 'android' | 'web' | 'universal'>;
  sdkVersion: string;
  moduleType: 'core' | 'community' | 'deprecated';
  tags: string[];
  codeBlocks: Array<{
    language: string;
    code: string;
    context: string;
  }>;
  embedding?: number[];
}

export interface CrawlConfig {
  baseUrl: string;
  allowedPaths: string[];
  excludePaths: string[];
  respectRobotsTxt: boolean;
  respectLlmsTxt: boolean;
  maxDepth: number;
  delay: number;
  userAgent: string;
}

export interface SearchQuery {
  query: string;
  filters?: {
    category?: Array<'docs' | 'api' | 'examples' | 'tutorials'>;
    platform?: Array<'ios' | 'android' | 'web' | 'universal'>;
    sdkVersion?: Array<'latest' | 'sdk-49' | 'sdk-48'>;
    moduleType?: Array<'core' | 'community' | 'deprecated'>;
  };
  facets?: string[];
  sortBy?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  documents: ExpoDocument[];
  totalCount: number;
  facets?: Record<string, Array<{ value: string; count: number }>>;
  searchTime: number;
}

export interface RecommendationRequest {
  context: string;
  platform?: 'ios' | 'android' | 'web' | 'universal';
  maxResults?: number;
  threshold?: number;
}

export interface RecommendationResult {
  title: string;
  url: string;
  reason: string;
  relevanceScore: number;
  contentType: string;
}

export interface IndexConfiguration {
  name: string;
  fields: Array<{
    name: string;
    type: 'string' | 'string[]' | 'int32' | 'float' | 'bool' | 'auto';
    facet?: boolean;
    index?: boolean;
    optional?: boolean;
    sort?: boolean;
  }>;
  defaultSortingField?: string;
}

export interface ExpoSDKModule {
  name: string;
  packageName: string;
  description: string;
  version: string;
  sdkVersion: string;
  installation: string;
  platforms: Array<'ios' | 'android' | 'web' | 'universal'>;
  permissions: string[];
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  methods: ExpoSDKMethod[];
  constants: Record<string, ExpoSDKConstant>;
  types: Record<string, ExpoSDKType>;
  examples: ExpoCodeExample[];
  documentationUrl: string;
  repositoryUrl: string;
  lastModified: Date;
  moduleType: 'core' | 'community' | 'deprecated';
  deprecated?: {
    reason: string;
    replacement?: string;
    since: string;
  };
}

export interface ExpoSDKMethod {
  name: string;
  signature: string;
  description: string;
  parameters: ExpoSDKParameter[];
  returnType: string;
  examples: ExpoCodeExample[];
  platforms: Array<'ios' | 'android' | 'web' | 'universal'>;
  availability: {
    since: string;
    deprecated?: string;
    replacement?: string;
    migrationUrl?: string;
  };
  permissions?: string[];
}

export interface ExpoSDKParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: any;
}

export interface ExpoSDKConstant {
  name: string;
  type: string;
  value: any;
  description: string;
  platforms: Array<'ios' | 'android' | 'web' | 'universal'>;
  deprecated?: {
    since: string;
    reason: string;
    replacement?: string;
  };
}

export interface ExpoSDKType {
  name: string;
  kind: 'interface' | 'type' | 'enum' | 'class';
  definition: string;
  description: string;
  properties?: Record<string, {
    type: string;
    description: string;
    required: boolean;
  }>;
}

export interface ExpoCodeExample {
  title: string;
  description: string;
  code: string;
  language: 'typescript' | 'javascript';
  platforms: Array<'ios' | 'android' | 'web' | 'universal'>;
  snackUrl?: string;
  dependencies: Record<string, string>;
}

export interface SDKVersionInfo {
  version: string;
  releaseDate: Date;
  status: 'latest' | 'supported' | 'deprecated' | 'unsupported';
  supportEndsDate?: Date;
  changelog: string;
  modules: Record<string, string>; // module name -> version
}

export interface PlatformCompatibility {
  platform: 'ios' | 'android' | 'web';
  supported: boolean;
  minVersion?: string;
  limitations?: string[];
  notes?: string;
}

export interface APIReference {
  moduleName: string;
  namespace: string;
  exports: Record<string, {
    type: 'function' | 'class' | 'constant' | 'type';
    signature: string;
    description: string;
  }>;
} 