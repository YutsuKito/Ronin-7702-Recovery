import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(appDir, '..')
const internalSignModule = resolve(
  repoRoot,
  'node_modules/@sky-mavis/waypoint/dist/module/headless/action/sign.js',
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sky-mavis/waypoint'],
  webpack(config) {
    config.resolve.alias['@waypoint-internal-sign'] = internalSignModule
    return config
  },
}

export default nextConfig
