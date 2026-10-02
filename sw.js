self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text()||""}}
  const isCall=data.type==="incoming_call";
  const title=data.title||"SpiderGram";
  const options={
    body:data.body||"Новое уведомление",
    tag:isCall?"spidergram-call":"spidergram",
    renotify:true,
    requireInteraction:isCall,
    vibrate:isCall?[300,150,300,150,600]:[200,100,200],
    data:{url:"/",type:data.type||"notification"}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){if("focus" in client)return client.focus()}
    if(clients.openWindow)return clients.openWindow("/");
  }));
});
