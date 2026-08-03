export interface Wallet {
    walletId: string,
    address: string,
    isCreated: boolean
}

export interface UserInterface {
    userId: string,
    wallets: Wallet[]
}