import { verifySiweMessage } from "../auth/auth.service"
import { notFound } from "../utils/api-error"
import { createWalletByUserId, findUserById } from "./users.repository"
import { UserInterface, Wallet } from "./users.types"

export const getCurrentUser = async (userId: string): Promise<UserInterface> => {
    const user = await findUserById(userId)
    if (!user) {
        throw notFound("user not found")
    }
    const wallets: Wallet[] = user.wallets.map((wallet) => ({
        walletId: wallet.id,
        address: wallet.address,
        isCreated: false
    }))

    return {
        userId: user.id,
        wallets
    }
}

export const setWallet = async (
    userId: string, 
    message: string, 
    signature: string
): Promise<Wallet> => {
    const verifiedSiwe = await verifySiweMessage({message, signature})
    const newWallet = await createWalletByUserId(userId, verifiedSiwe.address) 

    return {
        walletId: newWallet.walletId,
        address: newWallet.address,
        isCreated: newWallet.isCreated
    }
}