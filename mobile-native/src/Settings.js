import React from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {CloudDownload,CloudUpload,RefreshCw,ShieldCheck,Wifi,WifiOff,Trash2,AlertTriangle,CheckCircle2} from 'lucide-react-native';
import {Badge,Button,C,S,Section} from './design';

export function SettingsScreen({onBack,online,meta,pending,progress,syncing,onSync,onCleanup,onLogout,missionName}){
  const shown=meta?.at?new Date(meta.at).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Jamais';
  return <ScrollView contentContainerStyle={[S.content,{paddingBottom:40}]}>
    <Pressable onPress={onBack} style={{marginTop:21}}><Text style={{fontWeight:'800',color:C.blue}}>‹ Retour</Text></Pressable>
    <Section eyebrow="CONFIGURATION" title="Paramètres"/>
    <View style={S.card}>
      <View style={{flexDirection:'row',alignItems:'center',gap:9,marginBottom:13}}>
        {online?<Wifi color={C.green} size={20}/>:<WifiOff color={C.danger} size={20}/>}
        <Text style={{color:C.text,fontWeight:'900',fontSize:15}}>{online?'Connexion disponible':'Mode hors connexion'}</Text>
      </View>
      <Text style={S.muted}>Mission : {missionName||'Non sélectionnée'}</Text>
      <Text style={[S.muted,{marginTop:6}]}>Dernière préparation réussie : {shown}</Text>
      {meta?.stores!=null?<Text style={[S.muted,{marginTop:5}]}>{meta.stores} magasins · {meta.templates} questionnaires préparés · {meta.days} journées d’agenda</Text>:null}
      {meta?.stores!=null&&meta.templates<meta.stores?<Text style={{marginTop:7,color:C.danger,fontSize:12}}>Certains magasins n'ont pas de questionnaire disponible hors ligne.</Text>:null}
    </View>
    <Section eyebrow="ENVOI VERS LE CRM" title="Synchronisation"/>
    <View style={{flexDirection:'row',gap:8}}>
      {[['Visites',pending?.visits||0],['Photos',pending?.photos||0],['Erreurs',pending?.errors||0]].map(([label,value])=><View key={label} style={[S.card,{flex:1,padding:12,alignItems:'center'}]}>
        <Text style={{fontSize:26,fontWeight:'900',color:value&&label==='Erreurs'?C.danger:C.navy}}>{value}</Text>
        <Text style={S.muted}>{label}</Text>
      </View>)}
    </View>
    {!!(pending?.answers||pending?.actions)&&<Text style={[S.muted,{marginBottom:14}]}>{pending?.answers||0} réponses et {pending?.actions||0} actions encore à transmettre.</Text>}
    {pending?.items?.filter(v=>v.error).map(v=><View style={[S.card,{borderColor:'#F0B8B8'}]} key={v.id}>
      <Text style={{fontWeight:'800',color:C.danger}}>{v.store_name}</Text>
      <Text style={[S.muted,{marginTop:4}]}>{v.error}</Text>
    </View>)}
    {progress?<View style={[S.card,{backgroundColor:C.blueSoft}]}>
      <Text style={{color:C.blue,fontWeight:'800'}}>{progress.stage==='questionnaires'?'Téléchargement des questionnaires':progress.stage==='parc'?'Mise à jour du parc':progress.error?'Envoi interrompu':progress.message||'Synchronisation…'}</Text>
      {progress.stage==='questionnaires'?<Text style={S.muted}>{progress.current} / {progress.total} magasins</Text>:null}
    </View>:null}
    <Button label={syncing?'Synchronisation en cours…':'Synchroniser maintenant'} onPress={onSync} disabled={!online||syncing}/>
    <Text style={[S.muted,{marginTop:9}]}>L’envoi précède toujours la mise à jour du parc. Une visite non transmise reste sur le téléphone, même si le réseau coupe.</Text>
    <Section eyebrow="STOCKAGE LOCAL" title="Libérer de l’espace"/>
    <View style={S.card}>
      <View style={{flexDirection:'row',gap:12,alignItems:'center',marginBottom:13}}>
        <ShieldCheck size={23} color={C.green}/>
        <Text style={{fontSize:13,color:C.text,flex:1}}>Seules les copies locales des photos confirmées comme envoyées seront supprimées.</Text>
      </View>
      <Button label="Effacer les photos déjà synchronisées" outline onPress={onCleanup}/>
    </View>
    <View style={{marginTop:21}}><Button label="Déconnexion du compte" outline onPress={onLogout}/></View>
    <Text style={[S.muted,{marginTop:17,textAlign:'center'}]}>Mode hors ligne autorisé jusqu’à 48 h après la dernière authentification réussie. Les envois automatiques se relancent à l’ouverture et au retour du réseau. iOS ne garantit pas les envois lorsque l’application est fermée.</Text>
  </ScrollView>;
}
