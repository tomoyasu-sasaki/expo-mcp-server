// Mock for @modelcontextprotocol/sdk to avoid ES module issues in tests

// Server mock
class MockServer {
  constructor() {
    this.tools = new Map();
    this.resources = new Map();
    this.prompts = new Map();
    this.callbacks = new Map();
  }

  async connect(_transport) {
    return Promise.resolve();
  }

  async close() {
    return Promise.resolve();
  }

  setRequestHandler(method, handler) {
    this.callbacks.set(method, handler);
  }

  async sendRequest(_params) {
    return Promise.resolve({ result: 'mock-result' });
  }

  async sendNotification(_params) {
    return Promise.resolve();
  }
}

// StdioServerTransport mock
class MockStdioServerTransport {
  constructor() {
    this.readable = process.stdin;
    this.writable = process.stdout;
  }

  async start() {
    return Promise.resolve();
  }

  async close() {
    return Promise.resolve();
  }
}

// Tool schemas
const CallToolRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    arguments: { type: 'object' }
  }
};

const ListToolsRequestSchema = {
  type: 'object',
  properties: {}
};

const ListResourcesRequestSchema = {
  type: 'object', 
  properties: {}
};

const ReadResourceRequestSchema = {
  type: 'object',
  properties: {
    uri: { type: 'string' }
  }
};

const ListPromptsRequestSchema = {
  type: 'object',
  properties: {}
};

const GetPromptRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    arguments: { type: 'object' }
  }
};

// Export all the things that the real SDK exports
module.exports = {
  Server: MockServer,
  StdioServerTransport: MockStdioServerTransport,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  // Add more exports as needed
}; 