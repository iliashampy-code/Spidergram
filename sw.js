self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text()||""}}
  const title=data.title||"SpiderGram";
  const options={body:data.body||"Новое уведомление",tag:data.type||"spidergram",renotify:true,data:{url:"/"}};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){if("focus" in client)return client.focus()}
    if(clients.openWindow)return clients.openWindow("/");
  }));
});
