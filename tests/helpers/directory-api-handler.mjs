import {createHash} from 'node:crypto';
const VERSION='DIRECTORY-TEST';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
async function getSessionUser(request,env){return env.__sessionResolver ? env.__sessionResolver(request,env) : null;}
export function parseDirectoryOffset(url) {
  const raw = url.searchParams.get('offset') ?? '0';
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= 50000 ? value : null;
}

export async function directoryList(request, env, kind, resolveSession = getSessionUser) {
  const auth = await resolveSession(request, env);
  if (!auth) return json({ok:false,error:'UNAUTHENTICATED',version:VERSION},401);
  if (auth.user.role !== 'gerante') return json({ok:false,error:'FORBIDDEN',version:VERSION},403);
  if (!env.DB) return json({ok:false,database:false,error:'DATABASE_UNAVAILABLE',version:VERSION},503);

  const url = new URL(request.url);
  const offset = parseDirectoryOffset(url);
  if (offset === null) return json({ok:false,error:'INVALID_OFFSET',version:VERSION},400);

  const pageSize = 100;
  const limit = pageSize + 1;
  let rows;
  if (kind === 'clients') {
    rows = await env.DB.prepare(
      `SELECT c.id,c.user_id,c.address,c.city,c.postal_code,c.created_at,c.updated_at,
              u.first_name,u.last_name,u.email,u.phone,u.status AS user_status
         FROM clients c JOIN users u ON u.id=c.user_id
        ORDER BY c.created_at ASC,c.id ASC LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();
  } else {
    rows = await env.DB.prepare(
      `SELECT i.id,i.user_id,i.professional_status,i.description,i.service_area,
              i.hourly_rate,i.validation_status,i.created_at,i.updated_at,
              u.first_name,u.last_name,u.email,u.phone,u.status AS user_status
         FROM intervenants i JOIN users u ON u.id=i.user_id
        ORDER BY i.created_at ASC,i.id ASC LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();
  }

  const fetched = rows.results || [];
  const hasMore = fetched.length > pageSize;
  const items = fetched.slice(0, pageSize);
  return json({
    ok:true,
    version:VERSION,
    items,
    pagination:{offset,limit:pageSize,returned:items.length,has_more:hasMore,next_offset:hasMore ? offset + pageSize : null},
    has_more:hasMore,
    next_offset:hasMore ? offset + pageSize : null
  });
}

