import React,{useEffect,useMemo,useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import {C,S} from './design';

const DEFAULT_POSITIONS=[
 'Fond de rayon / linéaire','Tête de gondole (TG)','Univers Produits du monde',
 'Zone promotionnelle','Allée centrale','Îlot / podium','Meuble additionnel',
 'Bac frais / surgelés','Meuble réfrigéré','Meuble surgelé',
 'Zone saisonnière','Près des caisses','Cross-merchandising','Palette / box','Réserve'
];
export function readingsByProduct(rows=[]){
 const indexed={};
 for(const r of rows)if(r.mission_product_id)indexed[r.mission_product_id]=r;
 return indexed;
}
export function productCoverage(products=[],readings=[]){
 const byId=readingsByProduct(readings);
 const group=(list)=>{
   const present=list.filter(p=>byId[p.mission_product_id]?.present===true).length;
   const absent=list.filter(p=>byId[p.mission_product_id]?.present===false).length;
   return {total:list.length,present,absent,remaining:list.length-present-absent,
     percent:list.length?Math.round(present/list.length*100):null};
 };
 const required=products.filter(p=>p.required===true);
 const picking=products.filter(p=>p.required!==true);
 return {required:group(required),picking:group(picking),total:group(products)};
}
const numeric=(v,integer=false)=>{
 if(String(v??'').trim()==='')return null;
 const n=Number(String(v).replace(',','.'));
 if(!Number.isFinite(n)||n<0||(integer&&!Number.isInteger(n)))throw Error('Indique un nombre valide.');
 return n;
};
function ProductLine({product,reading,positions,editable,onSave}){
 const [more,setMore]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState('');
 const [draft,setDraft]=useState({price:'',facings:'',position:'',merchandising_note:''});
 useEffect(()=>setDraft({
   price:reading?.price==null?'':String(reading.price),
   facings:reading?.facings==null?'':String(reading.facings),
   position:reading?.position||'',
   merchandising_note:reading?.merchandising_note||''
 }),[product.mission_product_id,reading?.price,reading?.facings,reading?.position,reading?.merchandising_note]);
 const ready=reading?.present===true||reading?.present===false;
 async function save(patch){
   if(!editable||sending)return;
   setSending(true);setError('');
   try{
     const next={present:reading?.present??null,price:numeric(draft.price),facings:numeric(draft.facings,true),
       position:draft.position,merchandising_note:draft.merchandising_note,...patch};
     if(next.present!==true&&next.present!==false)throw Error('Sélectionne « Présent » ou « Absent » pour commencer.');
     await onSave(product.mission_product_id,next);
   }catch(e){setError(e?.message||'Erreur d’enregistrement.');}
   finally{setSending(false)}
 }
 return <View style={[S.card,{padding:14,marginBottom:9,borderColor:error?C.danger:C.border}]}>
   <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:9}}>
     <View style={{flex:1}}>
       <Text style={{fontSize:14,color:C.navy,fontWeight:'800'}} numberOfLines={3}>{product.name||product.sku||'Référence'}</Text>
       <Text style={[S.muted,{marginTop:4}]} numberOfLines={2}>{[product.brand,product.sku].filter(Boolean).join(' · ')}</Text>
     </View>
     <Text style={{fontSize:10,fontWeight:'800',color:product.required?C.blue:'#7B659A',backgroundColor:product.required?C.blueSoft:'#F2EEFA',paddingHorizontal:8,paddingVertical:5,borderRadius:8}}>{product.required?'DNO':'DNP'}</Text>
   </View>
   <View style={{flexDirection:'row',gap:8,marginTop:13}}>
     {[[true,'Présent'],[false,'Absent']].map(([value,label])=>{
       const selected=reading?.present===value;
       return <Pressable key={label} accessibilityRole="button" disabled={!editable||sending} onPress={()=>save({present:value})}
         style={{flex:1,minHeight:47,borderRadius:11,borderWidth:selected?2:1,borderColor:selected?(value?C.green:C.danger):C.border,backgroundColor:selected?(value?C.greenSoft:C.redSoft):'white',alignItems:'center',justifyContent:'center'}}>
         <Text style={{fontSize:14,fontWeight:'800',color:selected?(value?C.green:C.danger):C.text}}>{selected?'✓  ':''}{label}</Text>
       </Pressable>;
     })}
   </View>
   {!ready?<Text style={{color:'#956D2C',fontSize:11,marginTop:7}}>Présence à renseigner</Text>:null}
   {sending?<Text style={{color:C.blue,fontSize:11,marginTop:7}}>Enregistrement…</Text>:null}
   {error?<Text style={{color:C.danger,fontSize:11,marginTop:7}}>{error}</Text>:null}
   <Pressable onPress={()=>setMore(v=>!v)} style={{paddingTop:13,paddingBottom:5}}>
     <Text style={{color:C.blue,fontWeight:'750',fontSize:12}}>{more?'Masquer les détails ↑':'Prix, facings, emplacement et remarque ↓'}</Text>
   </Pressable>
   {more?<View style={{marginTop:12,gap:12}}>
     <View style={{flexDirection:'row',gap:10}}>
       <View style={{flex:1}}><Text style={S.eyebrow}>PRIX EN €</Text>
         <TextInput editable={editable} style={S.input} value={draft.price} onChangeText={v=>setDraft(x=>({...x,price:v}))} onBlur={()=>{if(ready)save({})}} placeholder="0,00" keyboardType="decimal-pad"/>
       </View>
       <View style={{flex:1}}><Text style={S.eyebrow}>FACINGS</Text>
         <TextInput editable={editable} style={S.input} value={draft.facings} onChangeText={v=>setDraft(x=>({...x,facings:v}))} onBlur={()=>{if(ready)save({})}} placeholder="0" keyboardType="number-pad"/>
       </View>
     </View>
     <Text style={S.eyebrow}>EMPLACEMENT</Text>
     <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
       {(positions.length?positions:DEFAULT_POSITIONS).map((name,i)=><Pressable key={i} disabled={!editable} onPress={()=>{setDraft(x=>({...x,position:name}));if(ready)save({position:name});}}
         style={{borderRadius:9,borderWidth:1,borderColor:draft.position===name?C.blue:C.border,backgroundColor:draft.position===name?C.blueSoft:'white',padding:9}}>
         <Text style={{fontSize:11,color:draft.position===name?C.blue:C.text}}>{name}</Text>
       </Pressable>)}
     </View>
     <Text style={S.eyebrow}>REMARQUE SUR LA RÉFÉRENCE</Text>
     <TextInput editable={editable} style={[S.input,{minHeight:80,textAlignVertical:'top',paddingTop:12}]} multiline maxLength={500}
       placeholder="Ex. rupture, facing incorrect, zone promotionnelle…"
       value={draft.merchandising_note} onChangeText={v=>setDraft(x=>({...x,merchandising_note:v}))} onBlur={()=>{if(ready)save({})}}/>
     <Pressable accessibilityRole="button" onPress={()=>save({})} disabled={!editable||sending} style={[S.buttonLight,{minHeight:45}]}>
       <Text style={S.buttonLightText}>Enregistrer les détails</Text>
     </Pressable>
   </View>:null}
 </View>;
}
function Metric({name,data,color=C.blue}){
 return <View style={{backgroundColor:'white',borderRadius:11,borderWidth:1,borderColor:C.border,flex:1,padding:11}}>
   <Text style={{color:C.muted,fontSize:11,fontWeight:'700'}}>{name}</Text>
   <Text style={{color,fontSize:22,fontWeight:'900',marginTop:5}}>{data.total?data.percent+' %':'—'}</Text>
   <Text style={{color:C.muted,fontSize:10,marginTop:3}}>{data.present} présent{data.present>1?'s':''} / {data.total} références</Text>
 </View>;
}
export function ProductsStep({products=[],readings=[],editable,onSave,positions=[]}){
 const coverage=productCoverage(products,readings);
 const byId=useMemo(()=>readingsByProduct(readings),[readings]);
 if(!products.length)return <View style={S.card}>
   <Text style={{fontSize:15,fontWeight:'800',color:C.text}}>Aucune référence affectée à ce magasin</Text>
   <Text style={[S.muted,{marginTop:7}]}>L’assortiment est déterminé par la centrale et la strate. Il n’est pas remplacé par une liste générale de produits.</Text>
 </View>;
 return <View>
   <Text style={S.eyebrow}>RELEVÉ DES RÉFÉRENCES</Text>
   <Text style={{fontSize:23,fontWeight:'900',color:C.navy,marginTop:8,marginBottom:9}}>Présence en rayon</Text>
   <Text style={[S.muted,{marginBottom:16}]}>Pour chaque référence, indique « Présent » ou « Absent ». Les deux DN sont calculées sur tout l’assortiment du magasin, et non uniquement sur les références déjà saisies.</Text>
   <View style={{flexDirection:'row',gap:9,marginBottom:13}}>
     <Metric name="DN obligatoire · DNO" data={coverage.required}/>
     <Metric name="DN picking · DNP" data={coverage.picking} color="#6752A9"/>
   </View>
   {coverage.total.remaining>0?<View style={{padding:12,backgroundColor:C.amberSoft,borderRadius:11,marginBottom:16}}>
     <Text style={{fontSize:12,fontWeight:'800',color:C.amber}}>{coverage.total.remaining} référence(s) encore à renseigner sur {coverage.total.total}</Text>
   </View>:<View style={{padding:12,backgroundColor:C.greenSoft,borderRadius:11,marginBottom:16}}>
     <Text style={{fontSize:12,fontWeight:'800',color:C.green}}>Toutes les références ont une réponse</Text>
   </View>}
   {['required','picking'].map(group=>{
     const list=products.filter(p=>group==='required'?p.required===true:p.required!==true);
     if(!list.length)return null;
     return <View key={group}>
       <Text style={{fontSize:15,fontWeight:'900',color:C.navy,marginVertical:12}}>{group==='required'?'Assortiment obligatoire (DNO)':'Assortiment picking (DNP)'} · {list.length}</Text>
       {list.map(p=><ProductLine key={p.mission_product_id} product={p} reading={byId[p.mission_product_id]} editable={editable} onSave={onSave} positions={positions}/>)}
     </View>;
   })}
 </View>;
}
export function CommentStep({value,onChange,editable}){
 return <View>
   <Text style={S.eyebrow}>BILAN DE VISITE</Text>
   <Text style={{fontSize:24,color:C.navy,fontWeight:'900',marginTop:8,marginBottom:9}}>Commentaire général</Text>
   <Text style={[S.muted,{marginBottom:16}]}>Note les informations utiles au suivi du magasin : engagement du responsable, rupture, prochain passage ou point de vigilance.</Text>
   <TextInput editable={editable} multiline maxLength={2000} style={[S.input,{minHeight:170,padding:15,paddingTop:15,textAlignVertical:'top',fontSize:15}]} placeholder="Mon commentaire de visite…" placeholderTextColor="#97A7B8" value={value||''} onChangeText={onChange}/>
   <Text style={{fontSize:11,color:C.muted,textAlign:'right',marginTop:9}}>{(value||'').length} / 2000 caractères · facultatif</Text>
 </View>;
}
