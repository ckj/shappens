const { merge } = require('webpack-merge')
const commonConfiguration = require('./webpack.common.js')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const SentryCliPlugin = require('@sentry/webpack-plugin');

module.exports = merge(
    commonConfiguration,
    {
        mode: 'production',
        plugins:
        [
            new CleanWebpackPlugin(),
            new SentryCliPlugin({
                include: './dist',
                ignoreFile: '.sentrycliignore',
                ignore: ['node_modules', 'webpack.config.js'],
                configFile: 'sentry.properties',
                setCommits: {
                    auto: true,
                    ignoreMissing: true,
                    ignoreEmpty: true,
                }
            })
        ]
    }
)
