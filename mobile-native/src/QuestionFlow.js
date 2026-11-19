import React,{useEffect,useRef,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {C,S} from './design';

// Shared between local-first and connected visit flows.
// One question per screen; every transition persists before moving on.
const answered=value=>value!==undefined&&value!==null&&!(typeof value==='string'&&value.trim()==='');
function optionsFor(q){
  try{
    const raw=typeof q.options==='string'?JSON.parse(q.options):q.options;
    return Array.isArray(raw)?raw:[];
  }catch{return []}
}
function isNumeric(q){return ['number','integer','decimal','numeric'].includes(String(q.type||'').toLowerCase())}
function isBoolean(q){return ['yes_no','boolean','bool'].includes(String(q.type||'').toLowerCase())}
function normalizeDraft(q,draft){
  if(!answered(draft))return null;
  if(isNumeric(q)){
    const raw=String(draft).replace(',','.').trim();
    const n=Number(raw);
    if(!Number.isFinite(n))throw Error('Saisis un nombre valide pour continuer.');
    return n;
  }
  return draft;
}
function sameValue(a,b){return a===b||(a!=null&&b!=null&&String(a)===String(b))}
function labelValue(value){
  if(!answered(value))return 'Non renseignée';
  if(value===true)return 'Oui';
  if(value===false)return 'Non';
  if(typeof value==='object')return 'Renseignée';
  return String(value);
}
export function QuestionFlow({questions=[],responses={},editable,onSave,onExit,storeName,saveLabel,summary,error,canContinue=true}){
  const [step,setStep]=useState(()=>{const first=questions.findIndex(q=>!answered(responses[q.id]));return first<0?questions.length:first;});
  const [draft,setDraft]=useState(null);
  const [busy,setBusy]=useState(false);
  const [localError,setLocalError]=useState('');
  const lock=useRef(false);
  const total=questions.length;
  const summaryStep=step>=total;
  const question=summaryStep?null:questions[step];
  const saved=question?responses[question.id]:undefined;
  const count=questions.filter(q=>answered(responses[q.id])).length;
  const position=total===0?100:Math.round((Math.min(step,total)/total)*100);
  const missing=questions.filter(q=>q.required&&!q.conditions&&!answered(responses[q.id]));
  useEffect(()=>{setDraft(saved==null?'':saved);setLocalError('')},[step,question?.id]);
  const selected=v=>sameValue(draft,v);
  async function move(next,allowEmptyRequired=false){
    if(lock.current||!canContinue)return;
    if(!question){setStep(Math.max(0,Math.min(total,next)));return;}
    let val;
    try{val=normalizeDraft(question,draft);}
    catch(e){setLocalError(e.message);return;}
    if(editable&&!allowEmptyRequired&&question.required&&!question.conditions&&!answered(val)){
      setLocalError('Cette réponse est obligatoire pour continuer.');
      return;
    }
    lock.current=true;setBusy(true);setLocalError('');
    try{
      if(editable&&!sameValue(saved,val)){
        await onSave(question.id,val);
      }
      setStep(Math.max(0,Math.min(total,next)));
    }catch(e){
      setLocalError('Réponse non enregistrée : '+String(e?.message||'Réessaie.'));
    }finally{lock.current=false;setBusy(false)}
  }
  const goExit=()=>{
    if(!editable||!question||sameValue(saved,draft)){onExit?.();return;}
    Alert.alert('Réponse en cours','Enregistrer cette réponse avant de quitter le relevé ?',[
      {text:'Rester',style:'cancel'},
      {text:'Quitter sans enregistrer',style:'destructive',onPress:onExit},
      {text:'Enregistrer',onPress:async()=>{try{await onSave(question.id,normalizeDraft(question,draft));onExit?.()}catch(e){setLocalError('Impossible de sauvegarder : '+e.message)}}}
    ]);
  };
  return <View style={{flex:1,backgroundColor:C.bg}}>
    <View style={{paddingHorizontal:20,paddingTop:17,paddingBottom:13,backgroundColor:'white',borderBottomColor:C.border,borderBottomWidth:1}}>
      <Pressable accessibilityRole="button" onPress={goExit} style={{alignSelf:'flex-start',paddingVertical:6,paddingRight:12,marginBottom:7}}>
        <Text style={{color:C.blue,fontWeight:'800',fontSize:13}}>‹ Quitter le relevé</Text>
      </Pressable>
      <Text numberOfLines={1} style={{color:C.navy,fontWeight:'900',fontSize:20}}>{storeName||'Ma visite'}</Text>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:14}}>
        <Text style={{color:C.blue,fontSize:12,fontWeight:'900'}}>{summaryStep?'Récapitulatif':`Question ${step+1} / ${total}`}</Text>
        <Text style={{fontSize:12,color:C.muted}}>{count} réponse{count>1?'s':''} renseignée{count>1?'s':''} · {position}%</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:position}} style={{height:7,borderRadius:10,backgroundColor:'#E6ECF5',overflow:'hidden',marginTop:9}}>
        <View style={{width:position+'%',height:'100%',backgroundColor:C.blue,borderRadius:10}}/>
      </View>
      <Text style={{fontSize:11,color:C.muted,marginTop:8}}>{saveLabel||'Enregistrement en passant à la question suivante'}</Text>
    </View>
    <ScrollView key={summaryStep?'summary':question?.id||step} style={{flex:1}} contentContainerStyle={{paddingHorizontal:20,paddingTop:24,paddingBottom:28}} keyboardShouldPersistTaps="handled">
      {!!(localError||error)&&<Text style={{color:C.danger,backgroundColor:C.redSoft,padding:12,borderRadius:10,marginBottom:16}}>{localError||error}</Text>}
      {summaryStep?<>
        <Text style={S.eyebrow}>FIN DU QUESTIONNAIRE</Text>
        <Text style={{fontWeight:'900',fontSize:25,color:C.navy,marginBottom:7}}>Récapitulatif de visite</Text>
        <Text style={[S.muted,{marginBottom:16}]}>Vérifie les réponses, puis finalise la visite en bas de page.</Text>
        {questions.length?<View style={S.card}>{questions.map((q,i)=><Pressable key={q.id} onPress={()=>setStep(i)} style={{borderBottomColor:C.border,borderBottomWidth:i<questions.length-1?1:0,paddingVertical:12}}>
          <Text numberOfLines={2} style={{fontWeight:'700',color:C.text,fontSize:13}}>{i+1}. {q.label}{q.required?' *':''}</Text>
          <Text numberOfLines={1} style={{fontSize:12,marginTop:4,color:answered(responses[q.id])?C.green:C.muted}}>{labelValue(responses[q.id])}</Text>
        </Pressable>)}</View>:null}
        {missing.length>0&&<Pressable onPress={()=>setStep(questions.findIndex(q=>q.id===missing[0].id))} style={[S.card,{backgroundColor:C.redSoft,borderColor:'#F2C9CD'}]}>
          <Text style={{fontWeight:'800',color:C.danger}}>{missing.length} question(s) obligatoire(s) sans réponse</Text>
          <Text style={{fontSize:12,color:C.danger,marginTop:5}}>Appuyer pour retourner à la première.</Text>
        </Pressable>}
        {summary}
      </>:question?<>
        <Text style={S.eyebrow}>{question.required?'RÉPONSE OBLIGATOIRE':'QUESTION FACULTATIVE'}</Text>
        <Text style={{fontWeight:'900',fontSize:25,lineHeight:33,color:C.navy,marginTop:10,marginBottom:23}}>{question.label}</Text>
        {isBoolean(question)?<View style={{gap:11}}>
          {[[true,'Oui'],[false,'Non']].map(([v,label])=><Pressable key={label} disabled={!editable||busy} onPress={()=>setDraft(v)} style={{minHeight:73,backgroundColor:selected(v)?C.blueSoft:'white',borderColor:selected(v)?C.blue:C.border,borderWidth:selected(v)?2:1,borderRadius:16,justifyContent:'center',paddingHorizontal:20}}>
            <Text style={{color:selected(v)?C.blue:C.text,fontWeight:'800',fontSize:19}}>{selected(v)?'✓  ':''}{label}</Text>
          </Pressable>)}
        </View>:optionsFor(question).length>0&&['select','single_choice','choice','radio'].includes(String(question.type||'').toLowerCase())?
          <View style={{gap:11}}>{optionsFor(question).map((option,i)=>{
            const v=typeof option==='object'?(option.value??option.label??String(i)):option;
            const label=typeof option==='object'?String(option.label??option.value??'Option'):String(option);
            return <Pressable key={i} disabled={!editable||busy} onPress={()=>setDraft(v)} style={{minHeight:65,backgroundColor:selected(v)?C.blueSoft:'white',borderColor:selected(v)?C.blue:C.border,borderWidth:selected(v)?2:1,borderRadius:15,justifyContent:'center',paddingHorizontal:17}}>
              <Text style={{fontSize:16,fontWeight:selected(v)?'800':'600',color:selected(v)?C.blue:C.text}}>{selected(v)?'✓  ':''}{label}</Text>
            </Pressable>;
          })}</View>:
          <TextInput editable={editable&&!busy} style={[S.input,{fontSize:18,minHeight:isNumeric(question)?65:132,textAlignVertical:'top',paddingTop:19}]} multiline={!isNumeric(question)} keyboardType={isNumeric(question)?'decimal-pad':'default'} value={draft==null?'':String(draft)} onChangeText={setDraft} placeholder="Saisir la réponse…" placeholderTextColor="#9EABBC" returnKeyType={isNumeric(question)?'done':'default'}/>
        }
      </>:<Text style={S.muted}>Aucune question disponible.</Text>}
    </ScrollView>
    <View style={{flexDirection:'row',gap:11,paddingHorizontal:20,paddingVertical:12,borderTopWidth:1,borderColor:C.border,backgroundColor:'white'}}>
      <Pressable accessibilityRole="button" disabled={busy||step===0} onPress={()=>move(step-1,true)} style={{minHeight:49,flex:1,borderColor:C.border,borderWidth:1,borderRadius:13,alignItems:'center',justifyContent:'center',opacity:step===0?0.4:1}}>
        <Text style={{color:C.navy,fontWeight:'800'}}>Précédent</Text>
      </Pressable>
      {!summaryStep?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>move(step+1)} style={{minHeight:49,flex:1.6,backgroundColor:C.blue,borderRadius:13,alignItems:'center',justifyContent:'center'}}>
        <Text style={{color:'white',fontWeight:'900'}}>{busy?'Enregistrement…':step===total-1?'Récapitulatif →':'Suivant →'}</Text>
      </Pressable>:<Pressable accessibilityRole="button" onPress={()=>missing.length?setStep(questions.findIndex(q=>q.id===missing[0].id)):onExit?.()} style={{minHeight:49,flex:1.6,backgroundColor:C.blueSoft,borderRadius:13,alignItems:'center',justifyContent:'center'}}>
        <Text style={{color:C.blue,fontWeight:'900'}}>{missing.length?'Réponses manquantes':'Retour à ma journée'}</Text>
      </Pressable>}
    </View>
  </View>;
}
