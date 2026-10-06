const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('ui/preview-state.js','utf8').replaceAll('export ',''),context);
const check=(units,next)=>{context.units=units;context.next=next;return vm.runInContext('withinModelBudget(units,next)',context);};
test('multi YDD aggregate vertex, resource and four-model caps',()=>{
 const unit=(vertices,bytes)=>({model:{vertices,decodedBytes:bytes}});
 assert.equal(check([unit(128883,20e6)],unit(50000,10e6)),true);
 assert.equal(check([unit(1500000,10)],unit(500001,10)),false);
 assert.equal(check(Array(4).fill(unit(1,1)),unit(1,1)),false);
 assert.equal(check([unit(1,400*1024**2)],unit(1,200*1024**2)),false);
 assert.equal(check([{...unit(1,200*1024**2),ytdBytes:200*1024**2}],unit(1,200*1024**2)),false);
});
test('separate row positions are centered and spaced',()=>{
 context.widths=[1,1,1];const positions=vm.runInContext('rowOffsets(widths)',context);assert.ok(Math.abs(positions[1])<1e-9);assert.ok(Math.abs(positions[0]+positions[2])<1e-9);assert.ok(positions[1]-positions[0]>=1);context.widths=[];assert.equal(vm.runInContext('rowOffsets(widths).length',context),0);
});
