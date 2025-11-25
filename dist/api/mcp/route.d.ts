declare const handler: (request: Request) => Promise<Response>;
export { handler as GET, handler as POST, handler as DELETE };
