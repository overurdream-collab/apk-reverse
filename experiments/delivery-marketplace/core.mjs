// Independent courier-marketplace demonstration. No Mrsool code or assets.
export const STATUS = Object.freeze({
  OPEN: "open", ASSIGNED: "assigned", PICKED_UP: "picked_up",
  DELIVERED: "delivered", CONFIRMED: "confirmed", CANCELLED: "cancelled"
});
const MAX_TEXT = 300;
const safeText = (input, title) => {
  const text = String(input ?? "").trim();
  if (!text || text.length > MAX_TEXT) throw new Error(title + " مطلوب (1–300 حرف)");
  return text;
};
const findOrder = (state, orderId) => {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) throw new Error("الطلب غير موجود");
  return order;
};
const draft = (state) => structuredClone(state);
const next = (state, prefix) => prefix + "-" + String(state.nextId++);
export const initialState = () => ({schemaVersion:1, nextId:1, orders:[], messages:[]});
export function createOrder(state, fields) {
  const s = draft(state);
  const o = {
    id: next(s, "REQ"), description: safeText(fields.description, "وصف الطلب"),
    pickup: safeText(fields.pickup, "موقع الاستلام"),
    dropoff: safeText(fields.dropoff, "موقع التسليم"),
    customerId: "demo-customer", status: STATUS.OPEN, offers:[],
    selectedOfferId:null, createdAt:new Date().toISOString()
  };
  s.orders.unshift(o);
  return s;
}
export function sendOffer(state, orderId, amount, courierId = "demo-courier") {
  const s = draft(state), o = findOrder(s, orderId);
  if(o.status !== STATUS.OPEN) throw new Error("هذا الطلب لا يقبل عروضاً جديدة");
  if(!Number.isSafeInteger(amount) || amount < 1 || amount > 10000000) {
    throw new Error("أدخل سعراً صحيحاً بالريال اليمني");
  }
  if(o.offers.some(q => q.courierId === courierId)) throw new Error("المندوب قدم عرضاً بالفعل");
  o.offers.push({id:next(s,"OFFER"),courierId,amount,createdAt:new Date().toISOString()});
  return s;
}
export function acceptOffer(state, orderId, offerId) {
  const s = draft(state), o = findOrder(s, orderId);
  if(o.status !== STATUS.OPEN) throw new Error("لم يعد اختيار العرض متاحاً");
  if(!o.offers.some(q=>q.id===offerId)) throw new Error("العرض غير صالح");
  o.selectedOfferId=offerId; o.status=STATUS.ASSIGNED;
  return s;
}
export function advanceOrder(state, orderId, courierId, step) {
  const s = draft(state), o = findOrder(s, orderId);
  const chosen=o.offers.find(q=>q.id===o.selectedOfferId);
  if(!chosen || chosen.courierId!==courierId) throw new Error("المندوب غير مخوّل بهذا الطلب");
  if(step==="pickup" && o.status===STATUS.ASSIGNED) o.status=STATUS.PICKED_UP;
  else if(step==="deliver" && o.status===STATUS.PICKED_UP) o.status=STATUS.DELIVERED;
  else throw new Error("تسلسل التوصيل غير صحيح");
  return s;
}
export function confirmDelivery(state, orderId) {
  const s=draft(state), o=findOrder(s,orderId);
  if(o.status!==STATUS.DELIVERED) throw new Error("يجب أن يؤكد المندوب التسليم أولاً");
  o.status=STATUS.CONFIRMED; return s;
}
export function cancelOrder(state, orderId) {
  const s=draft(state), o=findOrder(s,orderId);
  if(o.status!==STATUS.OPEN) throw new Error("الإلغاء التجريبي متاح قبل قبول العرض فقط");
  o.status=STATUS.CANCELLED;return s;
}
export function sendMessage(state, orderId, sender, body) {
  const s=draft(state), o=findOrder(s,orderId);
  if(!["customer","courier"].includes(sender)) throw new Error("جهة غير صالحة");
  if(!o.selectedOfferId || o.status===STATUS.CANCELLED) throw new Error("المحادثة بعد إسناد الطلب فقط");
  s.messages.push({id:next(s,"MSG"),orderId,sender,body:safeText(body,"الرسالة"),at:new Date().toISOString()});
  return s;
}
export function courierFee(order) {
  const offer=order.offers.find(q=>q.id===order.selectedOfferId);
  return offer ? offer.amount : null;
}
export const money = n => Number(n).toLocaleString("ar-YE") + " ر.ي";
export function loadState(raw) {
  if(!raw) return initialState();
  try {
    const s=JSON.parse(raw);
    if(s.schemaVersion===1 && Number.isSafeInteger(s.nextId) && Array.isArray(s.orders) && Array.isArray(s.messages)) return s;
  } catch { /* invalid demo storage */ }
  return initialState();
}
