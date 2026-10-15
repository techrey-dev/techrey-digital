import { afterEach, describe, expect, it, vi } from "vitest"
import { OrderRepository } from "./orderRepository"
import type { Order } from "./types"

const order = (id: string, status: Order["status"] = "diajukan") => ({ id, status }) as Order
const response = (orders: Order[]) => new Response(JSON.stringify({ orders }), { status: 200 })
const deferred = () => {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((done) => { resolve = done })
  return { promise, resolve }
}

afterEach(() => vi.unstubAllGlobals())

describe("sinkronisasi pesanan", () => {
  it("mengirim identitas penawaran yang dilihat pelanggan", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ order: order("TD-1") })))
    vi.stubGlobal("fetch", fetchMock)
    await new OrderRepository().acceptOffer("TD-1", { id: "offer-shown", version: 3 })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: "accept-offer", payload: { offerId: "offer-shown", offerVersion: 3 } })
  })
  it("respons lama tidak menimpa hasil refresh terbaru", async () => {
    const slow = deferred()
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValueOnce(response([order("baru")])))
    const repository = new OrderRepository()
    const first = repository.loadAccountOrders("user")
    await repository.loadAccountOrders("user", true)
    slow.resolve(response([order("lama")]))
    await first
    expect(repository.getSnapshot().orders[0].id).toBe("baru")
  })

  it("mengosongkan data segera saat berpindah akun", async () => {
    const slow = deferred()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response([order("milik-A")])).mockReturnValueOnce(slow.promise))
    const repository = new OrderRepository()
    await repository.loadAccountOrders("A")
    const second = repository.loadAccountOrders("B")
    expect(repository.getSnapshot().orders).toEqual([])
    slow.resolve(response([order("milik-B")]))
    await second
    expect(repository.getSnapshot().orders[0].id).toBe("milik-B")
  })

  it("refresh yang dimulai sebelum aksi tidak mengembalikan status lama", async () => {
    const slow = deferred()
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response([order("TD-1")]))
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(new Response(JSON.stringify({ order: order("TD-1", "menunggu-pembayaran") }))))
    const repository = new OrderRepository()
    await repository.loadAccountOrders("A")
    const refresh = repository.refreshAccountOrders("A")
    await repository.acceptOffer("TD-1", { id: "offer-1", version: 1 })
    slow.resolve(response([order("TD-1")]))
    await refresh
    expect(repository.getSnapshot().orders[0].status).toBe("menunggu-pembayaran")
  })

  it("aksi yang selesai setelah keluar tidak mengisi ulang data", async () => {
    const slow = deferred()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response([order("TD-1")])).mockReturnValueOnce(slow.promise))
    const repository = new OrderRepository()
    await repository.loadAccountOrders("A")
    const action = repository.acceptOffer("TD-1", { id: "offer-1", version: 1 })
    repository.prepareEmpty()
    slow.resolve(new Response(JSON.stringify({ order: order("TD-1") })))
    await action
    expect(repository.getSnapshot().orders).toEqual([])
  })
})
