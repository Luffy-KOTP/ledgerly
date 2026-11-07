import { cacheLife } from 'next/cache'
import { listBanks } from './paystack'
export async function getBanks() { 'use cache'; cacheLife('days'); return listBanks() }
