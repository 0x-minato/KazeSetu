import { PrismaClient } from '../../app/generated/prisma/client.js'
import { PrismaPg} from '@prisma/adapter-pg'
import { DATABASE_URL} from '../config/env.js'

const adapter = new PrismaPg({
    connectionString: DATABASE_URL, 
});  

export const prisma = new PrismaClient({
    adapter
})

export const connectDatabase = async () => {
    try {
        await prisma.$connect()
        console.log("database connected successfully")
    } catch(err) {
        console.error('database failed to connect', err)
        process.exit(1)
    }
}