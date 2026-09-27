export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      if (!env.DB) {
        return Response.json({
          ok: false,
          database: false,
          message: "D1 non connectée"
        });
      }

      const result = await env.DB
        .prepare("SELECT 1 AS ok")
        .first();

      return Response.json({
        ok: true,
        database: result?.ok === 1
      });
    }

    return Response.json({
      service: "PROCHÉLIA API",
      status: "ok"
    });
  }
};
