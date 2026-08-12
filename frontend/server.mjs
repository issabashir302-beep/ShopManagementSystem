import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const distDirectory = fileURLToPath(new URL('./dist/', import.meta.url))
const port = Number(process.env.PORT || 3000)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

function resolveAsset(pathname) {
  const relativePath = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '')
  const candidate = join(distDirectory, relativePath)
  if (!candidate.startsWith(distDirectory)) return null
  return existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(distDirectory, 'index.html')
}

createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    response.end('{"status":"ok"}')
    return
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' })
    response.end()
    return
  }

  try {
    const pathname = new URL(request.url, 'http://localhost').pathname
    const file = resolveAsset(pathname)
    if (!file || !existsSync(file)) {
      response.writeHead(404)
      response.end('Not found')
      return
    }

    response.writeHead(200, {
      'content-type': contentTypes[extname(file)] || 'application/octet-stream',
      'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    if (request.method === 'HEAD') response.end()
    else createReadStream(file).pipe(response)
  } catch {
    response.writeHead(400)
    response.end('Bad request')
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Shopwise frontend listening on port ${port}`)
})
