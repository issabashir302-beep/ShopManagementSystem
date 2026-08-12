import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router-dom'
import { shopwiseApi } from '../../services/shopwiseApi'
import { PageLoading } from '../../components/feedback/States'
import { ShopOnboarding } from './ShopOnboarding'
export function OwnerGate() { const shop = useQuery({ queryKey: ['shop'], queryFn: shopwiseApi.shop.get, retry: false }); if (shop.isLoading) return <PageLoading label="Loading shop" />; if (shop.error?.code === 'SHOP_NOT_FOUND') return <ShopOnboarding />; if (shop.error) throw shop.error; return <Outlet /> }
