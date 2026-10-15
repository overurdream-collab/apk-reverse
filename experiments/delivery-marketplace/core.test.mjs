import test from "node:test";
import assert from "node:assert/strict";
import {STATUS,initialState,createOrder,sendOffer,acceptOffer,advanceOrder,confirmDelivery,cancelOrder,sendMessage,courierFee,loadState} from "./core.mjs";
const start=()=>createOrder(initialState(),{description:"وثائق",pickup:"شارع الزبيري",dropoff:"حدة"});
test("independent request lifecycle and customer confirmation",()=>{
  const a=start(), id=a.orders[0].id;
  const b=sendOffer(a,id,1500,"courier1");
  const q=b.orders[0].offers[0];
  const c=acceptOffer(b,id,q.id);
  assert.equal(courierFee(c.orders[0]),1500);
  assert.equal(c.orders[0].status,STATUS.ASSIGNED);
  const d=sendMessage(c,id,"customer","الرجاء الاتصال قبل الوصول");
  const e=advanceOrder(d,id,"courier1","pickup");
  const f=advanceOrder(e,id,"courier1","deliver");
  const g=confirmDelivery(f,id);
  assert.equal(g.orders[0].status,STATUS.CONFIRMED);
  assert.equal(g.messages[0].body,"الرجاء الاتصال قبل الوصول");
  assert.equal(a.orders[0].status,STATUS.OPEN,"original state must remain unchanged");
});
test("integer amount enforced; no floating point payment math",()=>{
  const a=start(),id=a.orders[0].id;
  for(const value of [0,-10,19.5,NaN,Infinity,10000001]) {
    assert.throws(()=>sendOffer(a,id,value));
  }
  assert.equal(sendOffer(a,id,123,id).orders[0].offers[0].amount,123);
});
test("no duplicate courier offers and no bids after assignment",()=>{
  const a=start(),id=a.orders[0].id;
  const b=sendOffer(a,id,200,"c1");
  assert.throws(()=>sendOffer(b,id,300,"c1"));
  const c=acceptOffer(b,id,b.orders[0].offers[0].id);
  assert.throws(()=>sendOffer(c,id,250,"c2"));
  assert.throws(()=>acceptOffer(c,id,b.orders[0].offers[0].id));
});
test("order state transitions and courier authorization checked",()=>{
  const a=start(),id=a.orders[0].id;
  assert.throws(()=>confirmDelivery(a,id));
  assert.throws(()=>sendMessage(a,id,"courier","test"));
  const b=sendOffer(a,id,200,"c1");
  const c=acceptOffer(b,id,b.orders[0].offers[0].id);
  assert.throws(()=>advanceOrder(c,id,"wrong","pickup"));
  assert.throws(()=>advanceOrder(c,id,"c1","deliver"));
  const d=advanceOrder(c,id,"c1","pickup");
  assert.throws(()=>advanceOrder(d,id,"c1","pickup"));
  assert.throws(()=>cancelOrder(d,id));
});
test("cancel before acceptance; validate required fields",()=>{
  const a=start(),id=a.orders[0].id;
  const b=cancelOrder(a,id);
  assert.equal(b.orders[0].status,STATUS.CANCELLED);
  assert.throws(()=>sendOffer(b,id,500));
  assert.throws(()=>createOrder(a,{description:"",pickup:"a",dropoff:"b"}));
});
test("invalid local demo data resets instead of crashing",()=>{
  assert.deepEqual(loadState("bad-json"),initialState());
  assert.equal(loadState('{"schemaVersion":10}').orders.length,0);
});
