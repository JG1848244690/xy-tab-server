import configureOpenAPI from "./lib/configure-open-api.js"
import createApp from "./lib/create-app.js"
import index from './routes/index.route.js'
import tasks from './routes/tasks/tasks.index.js'
const app = createApp()

const routes = [
    index,
    tasks
] as const;


routes.forEach((route) => {
    app.route('/', route)
})

configureOpenAPI(app)

type AppType = typeof routes[number]

export default app