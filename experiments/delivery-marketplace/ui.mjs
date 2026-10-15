import {STATUS,initialState,createOrder,sendOffer,acceptOffer,advanceOrder,confirmDelivery,cancelOrder,sendMessage,courierFee,money,loadState} from "./core.mjs";
const KEY="independent-delivery-lab-v1";
let state=loadState(readLocal()), activeTab="customer", courierId="courier1";
const $=id=>document.getElementById(id);
const statusNames={open:"متاح للعروض",assigned:"تم إسناده",picked_up:"تم الاستلام",delivered:"بانتظار تأكيد العميل",confirmed:"مكتمل",cancelled:"ملغي"};
function readLocal(){try{return localStorage.getItem(KEY)}catch{return null}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{note("تعذر حفظ بيانات التجربة محلياً")}}
function note(text){const t=$("toast");t.textContent=text;t.style.display="block";clearTimeout(note.timer);note.timer=setTimeout(()=>t.style.display="none",4000)}
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=String(text);if(cls)e.className=cls;return e}
function add(parent,...children){for(const c of children)if(c)parent.append(c);return parent}
function btn(title,fn,cls){const b=el("button",title,cls||"");b.type="button";b.addEventListener("click",fn);return b}
function line(str,cls){return el("div",str,cls)}
function apply(action,success="تم تحديث الحالة"){try{state=action();persist();render();note(success)}catch(e){note(e.message||"حدث خطأ")}}
function renderChat(order,sender){
  const box=el("div",null,"chat");add(box,el("strong","محادثة الطلب"));
  const messages=state.messages.filter(m=>m.orderId===order.id);
  if(!messages.length)add(box,line("لا توجد رسائل بعد.","muted small"));
  for(const m of messages){const item=el("div",null,"message "+(m.sender===sender?"mine":""));
    add(item,el("b",m.sender==="customer"?"العميل":"المندوب"),line(m.body));box.append(item)}
  if(order.status===STATUS.CONFIRMED)return box;
  const row=el("form",null,"compose"),field=el("input"),send=el("button","إرسال");
  field.placeholder="رسالة تجريبية...";field.maxLength=300;field.required=true;send.type="submit";
  row.addEventListener("submit",e=>{e.preventDefault();apply(()=>sendMessage(state,order.id,sender,field.value),"تم إرسال الرسالة")});
  return add(box,add(row,field,send));
}
function card(order){const c=el("article",null,"order"),head=el("div",null,"order-head");
  add(head,el("h3",order.description),el("span",statusNames[order.status],"pill"));
  add(c,head,line(order.id+" • "+new Date(order.createdAt).toLocaleString("ar"),"small muted"),
    line("من: "+order.pickup,"details"),line("إلى: "+order.dropoff,"details"));
  return c;
}
function renderCustomer(){
  const root=$("customer-orders");root.replaceChildren();
  if(!state.orders.length){add(root,el("div","لم تُنشئ أي طلبات حتى الآن.","panel muted"));return}
  for(const o of state.orders){
    const c=card(o);
    if(o.status===STATUS.OPEN){
      add(c,line("عروض المندوبين ("+o.offers.length+")","small muted"));
      for(const q of o.offers){
        const row=el("div",null,"quote");
        add(row,line((q.courierId==="courier1"?"مندوب أ":"مندوب ب")+" • "+money(q.amount)),btn("قبول العرض",()=>apply(()=>acceptOffer(state,o.id,q.id),"تم إسناد الطلب")));
        add(c,row);
      }
      const actions=el("div",null,"actions");add(actions,btn("إلغاء الطلب",()=>apply(()=>cancelOrder(state,o.id),"أُلغي الطلب"),"ghost"));add(c,actions);
    } else if([STATUS.ASSIGNED,STATUS.PICKED_UP,STATUS.DELIVERED,STATUS.CONFIRMED].includes(o.status)) {
      add(c,line("رسوم التوصيل المتفق عليها: "+money(courierFee(o)),"small"));
      if(o.status===STATUS.DELIVERED)add(c,add(el("div",null,"actions"),btn("أؤكد استلام الطلب",()=>apply(()=>confirmDelivery(state,o.id),"أكد العميل الاستلام"))));
      add(c,renderChat(o,"customer"));
    }
    root.append(c);
  }
}
function renderCourier(){
  const root=$("courier-orders");root.replaceChildren();let count=0;
  for(const o of state.orders){
    const selected=o.offers.find(q=>q.id===o.selectedOfferId);
    if(o.status!==STATUS.OPEN && selected?.courierId!==courierId)continue;
    if(o.status===STATUS.CANCELLED || o.status===STATUS.CONFIRMED)continue;
    count++;
    const c=card(o);
    if(o.status===STATUS.OPEN){
      const existing=o.offers.find(q=>q.courierId===courierId);
      if(existing)add(c,line("عرضك: "+money(existing.amount)+" — بانتظار اختيار العميل","small muted"));
      else{
        const form=el("form",null,"compose"),field=el("input"),submit=el("button","تقديم العرض");
        field.type="number";field.min="1";field.step="1";field.max="10000000";field.required=true;field.placeholder="السعر بالريال اليمني";submit.type="submit";
        form.addEventListener("submit",e=>{e.preventDefault();apply(()=>sendOffer(state,o.id,Number(field.value),courierId),"تم تقديم العرض")});
        add(c,add(form,field,submit));
      }
    }else {
      add(c,line("العرض المقبول: "+money(courierFee(o)),"small"));
      const actions=el("div",null,"actions");
      if(o.status===STATUS.ASSIGNED)add(actions,btn("استلمت الطلب",()=>apply(()=>advanceOrder(state,o.id,courierId,"pickup"))));
      if(o.status===STATUS.PICKED_UP)add(actions,btn("وصلت وسلمت الطلب",()=>apply(()=>advanceOrder(state,o.id,courierId,"deliver"))));
      add(c,actions,renderChat(o,"courier"));
    }
    root.append(c);
  }
  if(!count)add(root,el("div","لا توجد طلبات متاحة أو مسندة لهذا المندوب.","panel muted"));
}
function renderAdmin(){
  const m=$("metrics");m.replaceChildren();
  const values=[["إجمالي الطلبات",state.orders.length],["متاح للعروض",state.orders.filter(o=>o.status===STATUS.OPEN).length],
    ["قيد التنفيذ",state.orders.filter(o=>[STATUS.ASSIGNED,STATUS.PICKED_UP,STATUS.DELIVERED].includes(o.status)).length],
    ["مكتمل",state.orders.filter(o=>o.status===STATUS.CONFIRMED).length],
    ["ملغي",state.orders.filter(o=>o.status===STATUS.CANCELLED).length],
    ["إجمالي العروض",state.orders.reduce((sum,o)=>sum+o.offers.length,0)]];
  for(const [title,value] of values){const c=el("div",null,"metric");add(c,el("b",value),line(title,"muted"));m.append(c)}
  const summary=$("admin-summary");summary.replaceChildren();
  for(const o of state.orders.slice(0,10))add(summary,line(o.id+" • "+o.description+" • "+statusNames[o.status],"small"));
}
function render(){renderCustomer();renderCourier();renderAdmin()}
function switchTab(tab){activeTab=tab;for(const b of document.querySelectorAll("[data-tab]"))b.classList.toggle("active",b.dataset.tab===tab);
  for(const p of document.querySelectorAll(".role"))p.classList.toggle("hidden",p.id!==tab)}
for(const b of document.querySelectorAll("[data-tab]"))b.addEventListener("click",()=>switchTab(b.dataset.tab));
$("courier-id").addEventListener("change",e=>{courierId=e.target.value;renderCourier()});
$("order-form").addEventListener("submit",e=>{
  e.preventDefault();
  const description=$("description").value,pickup=$("pickup").value,dropoff=$("dropoff").value;
  apply(()=>createOrder(state,{description,pickup,dropoff}),"نُشر الطلب التجريبي");
  if(state.orders[0]?.description===description.trim())e.target.reset();
});
$("reset").addEventListener("click",()=>{
  if(!window.confirm("مسح جميع الطلبات والرسائل التجريبية من هذا المتصفح؟"))return;
  state=initialState();persist();render();note("تمت إعادة ضبط المختبر");
});
render();
