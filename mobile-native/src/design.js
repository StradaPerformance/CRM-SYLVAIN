import React from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';

export const C = {
  navy:'#111E33', navy2:'#263C59', blue:'#2875E7', blueSoft:'#EAF2FF',
  white:'#FFFFFF', bg:'#F4F7FB', text:'#14233A', muted:'#70819A', border:'#E4EAF2',
  green:'#0E9A68', greenSoft:'#E5F7EF', amber:'#AB6A16', amberSoft:'#FFF3DF',
  danger:'#BB3D47', redSoft:'#FFF1F1'
};
export const S = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},
  content:{paddingHorizontal:20,paddingBottom:25},
  card:{backgroundColor:C.white,borderColor:C.border,borderWidth:1,borderRadius:17,padding:17,marginBottom:11},
  sectionTitle:{fontSize:20,fontWeight:'800',letterSpacing:-.5,color:C.text,marginBottom:13},
  eyebrow:{fontSize:10,fontWeight:'900',color:C.blue,letterSpacing:1.5,marginBottom:7},
  text:{fontSize:14,color:C.text}, muted:{fontSize:12,color:C.muted,lineHeight:19},
  button:{minHeight:49,borderRadius:13,alignItems:'center',justifyContent:'center',paddingHorizontal:16,backgroundColor:C.blue},
  buttonText:{color:'white',fontWeight:'800',fontSize:14},
  buttonLight:{minHeight:49,borderRadius:13,alignItems:'center',justifyContent:'center',paddingHorizontal:16,borderWidth:1,borderColor:C.border,backgroundColor:'white'},
  buttonLightText:{color:C.blue,fontWeight:'800',fontSize:14},
  input:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:12,paddingHorizontal:14,minHeight:49,fontSize:14,color:C.text},
  row:{flexDirection:'row',alignItems:'center'},
  divider:{height:1,backgroundColor:C.border,marginVertical:13},
});
export function Button({label,onPress,outline=false,disabled=false,style}){
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[outline?S.buttonLight:S.button,disabled&&{opacity:.5},style]}>
    <Text style={outline?S.buttonLightText:S.buttonText}>{label}</Text>
  </Pressable>;
}
export function Empty({title,subtitle}){
  return <View style={[S.card,{alignItems:'center',paddingVertical:31}]}>
    <Text style={{fontSize:16,fontWeight:'800',color:C.text,marginBottom:8,textAlign:'center'}}>{title}</Text>
    <Text style={[S.muted,{textAlign:'center',paddingHorizontal:10}]}>{subtitle}</Text>
  </View>;
}
export function Loader({text='Chargement…'}){
  return <View style={{padding:32,alignItems:'center',gap:12}}><ActivityIndicator color={C.blue}/><Text style={S.muted}>{text}</Text></View>;
}
export function Section({eyebrow,title,right}){
  return <View style={[S.row,{justifyContent:'space-between',marginTop:25,marginBottom:13}]}>
    <View><Text style={S.eyebrow}>{eyebrow}</Text><Text style={[S.sectionTitle,{marginBottom:0}]}>{title}</Text></View>{right}
  </View>;
}
export function Badge({text,tone='blue'}){
  const styles={blue:[C.blueSoft,C.blue],green:[C.greenSoft,C.green],amber:[C.amberSoft,C.amber],muted:['#F1F3F7',C.muted]};
  const [bg,fg]=styles[tone]||styles.blue;
  return <View style={{backgroundColor:bg,paddingVertical:6,paddingHorizontal:9,borderRadius:999}}><Text style={{fontSize:10,fontWeight:'800',color:fg}}>{text}</Text></View>;
}
export function formatDate(day,withYear=true){
  try {return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',weekday:'long',day:'numeric',month:'long',...(withYear?{year:'numeric'}:{})}).format(new Date(day+'T12:00:00Z'));}
  catch(_){return day;}
}
export function todayParis(){
  const parts=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
}
export function shiftDay(day,offset){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
export function time(minutes){const n=Number(minutes)||0;return String(Math.floor(n/60)).padStart(2,'0')+'h'+String(n%60).padStart(2,'0');}
