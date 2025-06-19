// Mock for @xenova/transformers to avoid ES module issues in tests
module.exports = {
  pipeline: jest.fn().mockImplementation(() => 
    Promise.resolve({
      embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3, 0.4, 0.5]]),
      encode: jest.fn().mockResolvedValue([1, 2, 3, 4, 5]),
    })
  ),
  env: {
    backends: {
      onnx: {
        wasm: {
          wasmPaths: '/mock/path/',
        },
      },
    },
    allowLocalModels: false,
    allowRemoteModels: false,
  },
}; 