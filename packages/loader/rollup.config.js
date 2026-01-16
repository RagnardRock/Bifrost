import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'

export default {
  input: 'src/loader.ts',
  output: {
    file: 'dist/loader.min.js',
    format: 'iife',
    name: 'BifrostLoader',
    sourcemap: true,
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
    }),
    terser({
      format: {
        comments: false,
      },
    }),
  ],
}
