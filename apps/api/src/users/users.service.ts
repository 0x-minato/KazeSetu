import { Prisma } from "../../app/generated/prisma/client"
import { verifySiweMessage } from "../auth/auth.service"
import { notFound } from "../utils/api-error"
import { createWalletByUserId, deleteWalletForUser, findUserById, findWalletByAddress } from "./users.repository"
import { UserInterface, Wallet } from "./users.types"

export const getCurrentUser = async (userId: string): Promise<UserInterface> => {
    const user = await findUserById(userId)
    if (!user) {
        throw notFound("user not found")
    }
    const wallets: Wallet[] = user.wallets.map((wallet) => ({
        walletId: wallet.id,
        address: wallet.address,
    }))

    return {
        userId: user.id,
        wallets
    }
}

export const linkWallet = async (
    userId: string, 
    message: string, 
    signature: string
): Promise<Wallet> => {
    const verifiedSiwe = await verifySiweMessage({message, signature})
    try {
        const newWallet = await createWalletByUserId(userId, verifiedSiwe.address) 
        return {
            walletId: newWallet.walletId,
            address: newWallet.address,
            isCreated: newWallet.isCreated
        }
    } catch(error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            const concurrentWallet = await createWalletByUserId(userId, verifiedSiwe.address)
            return {
                walletId: concurrentWallet.walletId,
                address: concurrentWallet.address,
                isCreated: concurrentWallet.isCreated
            }
        }

        throw error
    }
}

export const unlinkWallet = async (
    userId: string,
    walletId: string,
    message: string,
    signature: string
) => {
    const verifiedSiwe = await verifySiweMessage({message, signature})
    const wallet = await findWalletByAddress(verifiedSiwe.address)
    if (!wallet || wallet.id !== walletId || wallet.userId !== userId) throw notFound("wallet for user not found") 
    await deleteWalletForUser(wallet.address)
}