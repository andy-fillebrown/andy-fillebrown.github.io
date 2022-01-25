module.exports = {
    context: __dirname,
    devServer: {
        contentBase: __dirname,
        host: '0.0.0.0',
        port: 9000,
        useLocalIp: true,
        watchContentBase: true,
    },
}
