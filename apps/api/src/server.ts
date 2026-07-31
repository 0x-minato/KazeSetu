import { app } from "./app.js"
import { connectDatabase } from "./config/database.js"
import { PORT } from "./config/env.js"

export const startServer = async (): Promise<void> => {
    await connectDatabase()
    app.listen(PORT, () => {
        console.log(`Server started at port ${PORT}`)
    })
}

await startServer().catch((err) => {
    console.log("server err", err)
})