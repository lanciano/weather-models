import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/* Vite לא יודע להגיש פונקציות Netlify, ולכן בדב הנתיב /.netlify/functions/*
   היה נופל ל-index.html ומחזיר HTML עם 200 — כלומר סעיף אל ניניו פשוט לא
   הופיע, ורק בפרודקשן אפשר היה לבדוק אותו. התוסף הזה מריץ את אותו קובץ
   handler עצמו, כדי שמה שרואים בדב יהיה מה שירוץ בשרת. */
const netlifyFunctions = () => ({
  name: 'netlify-functions-dev',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const m = req.url.match(/^\/\.netlify\/functions\/([\w-]+)/)
      if (!m) return next()
      try {
        /* נתיב מוחלט משורש הפרויקט: Vite מקמפל את הקובץ הזה לתיקייה זמנית
           תחת node_modules, ושם נתיב יחסי מצביע למקום הלא נכון.
           חותם הזמן מבטיח שעריכה של הפונקציה תיתפס בלי להפעיל מחדש את השרת. */
        const file = resolve(server.config.root, 'netlify/functions', `${m[1]}.mjs`)
        const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`)
        const out = await mod.default(new Request(`http://localhost${req.url}`), {})
        res.statusCode = out.status
        out.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(await out.text())
      } catch (e) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: String(e) }))
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), netlifyFunctions()],
})
