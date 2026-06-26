const commonjs = require('@rollup/plugin-commonjs');
const resolve = require('@rollup/plugin-node-resolve').default;
const terser = require('@rollup/plugin-terser');
const typescript = require('@rollup/plugin-typescript');
const dts = require('rollup-plugin-dts').default;
const peerDepsExternal = require('rollup-plugin-peer-deps-external');

module.exports = [
  {
    input: 'src/index.ts',
    external: ['react', 'react-dom', '@tanstack/react-query', 'vrixo-sdk'],
    output: [
      {
        file: 'lib/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: 'lib/index.mjs',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve({ browser: true, extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx'] }),
      commonjs(),
      typescript({
        tsconfig: false,
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          esModuleInterop: true,
          skipLibCheck: true,
        },
      }),
      terser(),
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'lib/index.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
];
