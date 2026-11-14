const hour=3600000,day=24*hour,riyadhOffset=3*hour;
function workingMinutes(from,to){
 if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)return 0;
 const first=Math.floor((from+riyadhOffset)/day),last=Math.floor((to+riyadhOffset)/day);
 const overlap=d=>Math.max(0,Math.min(to,d*day+23*hour-riyadhOffset)-Math.max(from,d*day+14*hour-riyadhOffset));
 return (overlap(first)+(last===first?0:overlap(last)+(last-first-1)*9*hour))/60000;
}
module.exports={workingMinutes};
