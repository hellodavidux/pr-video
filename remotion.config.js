import path from 'path'
import { Config } from '@remotion/cli/config'

Config.overrideWebpackConfig((config) => {
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      '@cal-simple': path.join(process.cwd(), 'cal-simple', 'src'),
    },
  }

  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false,
    },
  })

  return config
})
