import "dotenv/config"
import express from "express"
import cors from "cors"
import path from "path"
import authRouter from "./auth.js"
import imagesRouter from "./images.js"

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: "http://localhost:5173" }))
app.use(express.json())
app.use("/api/uploads", express.static(path.join(import.meta.dirname, "uploads")))

app.use("/api/auth", authRouter)
app.use("/api/images", imagesRouter)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
