/**
 * Server Entry Point
 *
 * Creates required directories, starts the Express server,
 * and handles graceful shutdown on SIGTERM/SIGINT.
 */
declare const server: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
export default server;
//# sourceMappingURL=server.d.ts.map