import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, Platform, StatusBar, Alert, ActivityIndicator,
  Dimensions, Modal, Animated, PanResponder, Linking, BackHandler
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, RADIUS, SHADOW, fixMediaUrl } from '../theme';
import { apiFetch } from '../api';
import { getHaversineDistanceMeters, formatDistance } from '../utils/geo';
import SponsorDetailScreen from './SponsorDetailScreen';

const { width: W, height: H } = Dimensions.get('window');
const TOP_INSET = Platform.OS === 'ios' ? 54 : 44;
const BOTTOM_INSET = Platform.OS === 'ios' ? 34 : 16;
const SNAP_COLLAPSED = 140;
const SNAP_HALF = H * 0.48;
const SNAP_FULL = H - TOP_INSET - 10;
const GRID_GAP = 10;
const CARD_W = (W - 32 - GRID_GAP) / 2;

// CSS Injection to hide Google Maps web banners so our custom top bar is the only option
const INJECT_HIDE_PROMO = `
  var style = document.createElement('style');
  style.innerHTML = '.ml-promo-app-switcher, .ml-smart-banner, .ml-promotion, .app-view-promo, .ml-snackbar { display: none !important; }';
  document.head.appendChild(style);
  true;
`;

function isInsideCorridor(uLat, uLng, aLat, aLng, bLat, bLng, w) {
  if (uLat == null || aLat == null || bLat == null) return false;
  const la = ((aLat + bLat) / 2) * Math.PI / 180;
  const by = (bLat - aLat) * 111000, bx = (bLng - aLng) * 111000 * Math.cos(la);
  const py = (uLat - aLat) * 111000, px = (uLng - aLng) * 111000 * Math.cos(la);
  const ss = bx * bx + by * by;
  if (ss === 0) return Math.sqrt(px * px + py * py) <= w / 2;
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / ss));
  return Math.sqrt((px - t * bx) ** 2 + (py - t * by) ** 2) <= w / 2;
}

const SG = [['#1e40af','#3b82f6'],['#7e22ce','#a855f7'],['#0e7490','#06b6d4'],['#b91c1c','#ef4444'],['#c2410c','#f97316'],['#15803d','#22c55e'],['#4338ca','#6366f1'],['#0369a1','#0ea5e9'],['#be185d','#ec4899']];
function sGrad(id){let h=0;const s=String(id);for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return SG[Math.abs(h)%SG.length]}
function walkEta(m){if(m==null)return'';return`~${Math.max(1,Math.round(m/84))} min`}

function FloatingToast({message,icon,color,visible,onHide}){
  const ty=useRef(new Animated.Value(-100)).current,op=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(!visible)return;
    Animated.parallel([Animated.spring(ty,{toValue:0,friction:8,tension:120,useNativeDriver:true}),Animated.timing(op,{toValue:1,duration:200,useNativeDriver:true})]).start();
    const t=setTimeout(()=>Animated.parallel([Animated.timing(ty,{toValue:-100,duration:250,useNativeDriver:true}),Animated.timing(op,{toValue:0,duration:250,useNativeDriver:true})]).start(()=>onHide?.()), 3500);
    return()=>clearTimeout(t);
  },[visible]);
  if(!visible)return null;
  return <Animated.View style={[$.toastW,{transform:[{translateY:ty}],opacity:op}]}><View style={[$.toastI,{borderLeftColor:color||COLORS.success}]}><Text style={{fontSize:16}}>{icon||'✓'}</Text><Text style={$.toastT}>{message}</Text></View></Animated.View>;
}

function GpsPulse({status}){
  const p=useRef(new Animated.Value(0.4)).current;
  useEffect(()=>{
    if(status==='ready'){Animated.loop(Animated.sequence([Animated.timing(p,{toValue:1,duration:1000,useNativeDriver:true}),Animated.timing(p,{toValue:0.4,duration:1000,useNativeDriver:true})])).start()}
    else p.setValue(0.4);
  },[status]);
  const c=status==='ready'?COLORS.success:status==='locating'?COLORS.accent:COLORS.error;
  return <View style={{width:10,height:10,alignItems:'center',justifyContent:'center'}}>{status==='ready'&&<Animated.View style={{position:'absolute',width:16,height:16,borderRadius:8,backgroundColor:c,opacity:p,transform:[{scale:p}]}}/>}<View style={{width:8,height:8,borderRadius:4,backgroundColor:c,borderWidth:1.5,borderColor:'#fff'}}/></View>;
}

function GlassBtn({onPress,children,size=42,style}){
  const sc=useRef(new Animated.Value(1)).current;
  return <TouchableOpacity activeOpacity={1} onPressIn={()=>Animated.spring(sc,{toValue:0.88,friction:5,useNativeDriver:true}).start()} onPressOut={()=>Animated.spring(sc,{toValue:1,friction:4,useNativeDriver:true}).start()} onPress={()=>{Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});onPress?.()}}><Animated.View style={[$.glassBtn,{width:size,height:size,borderRadius:size/2,transform:[{scale:sc}]},style]}>{children}</Animated.View></TouchableOpacity>;
}

function QuestHUD({done,total,selfieOpen,opacity}){
  const pct=total>0?done/total:0,bw=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.spring(bw,{toValue:pct,friction:10,useNativeDriver:false}).start()},[pct]);
  const statusColor=selfieOpen?COLORS.success:COLORS.error;
  return(
    <Animated.View style={[$.questHud,{opacity}]} pointerEvents="none">
      <View style={$.questI}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <View style={[$.questDot,{backgroundColor:statusColor}]}/>
          <Text style={$.questL}>{done}/{total} done</Text>
        </View>
        <View style={$.questBar}>
          <Animated.View style={[$.questF,{width:bw.interpolate({inputRange:[0,1],outputRange:['0%','100%']}),backgroundColor:statusColor}]}/>
        </View>
      </View>
    </Animated.View>
  );
}

function ImageZoomModal({images,initialIndex,onClose}){
  const [index,setIndex]=useState(initialIndex||0);
  const [zoomed,setZoomed]=useState(false);
  const scale=useRef(new Animated.Value(1)).current;
  const pan=useRef(new Animated.ValueXY({x:0,y:0})).current;
  const lastTap=useRef(0);
  const panOff=useRef({x:0,y:0});

  const reset=useCallback(()=>{
    setZoomed(false);
    Animated.parallel([Animated.spring(scale,{toValue:1,useNativeDriver:true}),Animated.spring(pan,{toValue:{x:0,y:0},useNativeDriver:true})]).start();
    panOff.current={x:0,y:0};
  },[scale,pan]);

  const goTo=useCallback((i)=>{setIndex(i);reset()},[reset]);

  const zoomedRef=useRef(false);
  useEffect(()=>{zoomedRef.current=zoomed},[zoomed]);

  const panR=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:(_,g)=>zoomedRef.current&&(Math.abs(g.dx)>4||Math.abs(g.dy)>4),
    onPanResponderGrant:()=>{pan.setOffset(panOff.current);pan.setValue({x:0,y:0})},
    onPanResponderMove:(_,g)=>{if(zoomedRef.current)pan.setValue({x:g.dx,y:g.dy})},
    onPanResponderRelease:(_,g)=>{
      pan.flattenOffset();
      panOff.current={x:pan.x._value,y:pan.y._value};
      if(Math.abs(g.dx)<12&&Math.abs(g.dy)<12){
        const now=Date.now();
        if(now-lastTap.current<300){
          const nz=!zoomedRef.current;
          zoomedRef.current=nz;setZoomed(nz);
          Animated.spring(scale,{toValue:nz?2.5:1,useNativeDriver:true}).start();
          if(!nz){Animated.spring(pan,{toValue:{x:0,y:0},useNativeDriver:true}).start();panOff.current={x:0,y:0}}
          lastTap.current=0;
        }else lastTap.current=now;
      }
    },
  })).current;

  return(
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={$.pvBg}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}/>
        <View style={$.pvCard}>
          <View style={$.pvTop}>
            <View><Text style={$.pvTitle}>Reference Photo</Text><Text style={$.pvMode}>{index+1} / {images.length} · Double-tap to zoom</Text></View>
            <GlassBtn onPress={onClose} size={32}><Ionicons name="close" size={18} color="#fff"/></GlassBtn>
          </View>
          <View style={$.pvBox} {...panR.panHandlers}>
            <Animated.Image source={{uri:fixMediaUrl(images[index])}} style={[$.pvImg,{transform:[{scale},{translateX:pan.x},{translateY:pan.y}]}]} resizeMode="contain"/>
          </View>
          {images.length>1&&(
            <View style={$.pvNav}>
              <TouchableOpacity onPress={()=>goTo(Math.max(0,index-1))} disabled={index===0} style={[$.pvArrow,index===0&&{opacity:0.25}]}><Ionicons name="chevron-back" size={22} color="#fff"/></TouchableOpacity>
              <View style={$.pvDots}>{images.map((_,i)=><View key={i} style={[$.pvDot,i===index&&$.pvDotA]}/>)}</View>
              <TouchableOpacity onPress={()=>goTo(Math.min(images.length-1,index+1))} disabled={index===images.length-1} style={[$.pvArrow,index===images.length-1&&{opacity:0.25}]}><Ionicons name="chevron-forward" size={22} color="#fff"/></TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SpotDetailPanel({spot,distance,isInside,isUploading,onClose,onCapture,onNavigate,onExploreZone,onPreview}){
  const ty=useRef(new Animated.Value(H)).current;
  useEffect(()=>{
    if(spot)Animated.spring(ty,{toValue:0,friction:9,tension:80,useNativeDriver:true}).start();
    else Animated.timing(ty,{toValue:H,duration:200,useNativeDriver:true}).start();
  },[spot]);
  if(!spot)return null;
  const isSelfie=spot.checkpoint_type==='selfie',sub=spot.submission;
  const isPend=sub?.status==='pending',isRej=sub?.status==='rejected';
  const accent=spot.completed?COLORS.success:isSelfie?COLORS.rose:COLORS.brand;

  const samplePhotos=useMemo(()=>{
    if(spot.sample_photo_urls?.length)return spot.sample_photo_urls;
    if(spot.sample_photo_url)return[spot.sample_photo_url];
    return[];
  },[spot]);

  return(
    <Animated.View style={[$.spPanel,{transform:[{translateY:ty}]}]}>
      <View style={$.spHandleRow}>
        <View style={{flex:1}}/>
        <View style={$.spBar}/>
        <View style={{flex:1, alignItems:'flex-end'}}>
          <TouchableOpacity onPress={onClose} style={$.spClose} hitSlop={{top:15,bottom:15,left:15,right:15}}>
            <Ionicons name="close-circle" size={28} color={COLORS.textTer}/>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:16,paddingBottom:BOTTOM_INSET+40}}>
        <View style={[$.spTypePill,{backgroundColor:accent+'18'}]}><Text style={[$.spTypeT,{color:accent}]}>{isSelfie?'📸 Selfie Spot':'🏢 Sponsor Zone'}</Text></View>
        <Text style={$.spName}>{spot.name}</Text>
        {Boolean(spot.description)&&<Text style={$.spDesc}>{spot.description}</Text>}

        <View style={$.spMeta}>
          <View style={$.spPts}><Ionicons name="trophy" size={13} color={COLORS.accentDark}/><Text style={$.spPtsT}>+{spot.points} pts</Text></View>
          <Text style={$.spRad}>{isSelfie?`${spot.radius_meters}m radius`:`${spot.corridor_width_meters}m corridor`}</Text>
        </View>

        <View style={$.spProx}>
          <View style={$.proxTrack}><View style={[$.proxFill,{width:isInside?'100%':distance!=null?`${Math.max(5,Math.min(95,(1-distance/500)*100))}%`:'5%',backgroundColor:isInside?COLORS.success:distance!=null&&distance<100?COLORS.accent:COLORS.textMuted}]}/></View>
          <Text style={[$.proxLbl,isInside&&{color:COLORS.success,fontWeight:FONT.w8}]}>
            {isInside?(isSelfie?"🎯 You're in the zone!":'🏢 Inside sponsor corridor!')
            :distance!=null?`📍 ${formatDistance(distance)} away · ${walkEta(distance)}`:'Acquiring location…'}
          </Text>
        </View>

        {(spot.completed||isPend||isRej)&&(
          <View style={{flexDirection:'row',gap:6,marginTop:8,flexWrap:'wrap'}}>
            {spot.completed&&<View style={$.bDn}><Ionicons name="checkmark-circle" size={12} color={COLORS.success}/><Text style={$.bDnT}>Completed</Text></View>}
            {isPend&&<View style={$.bPn}><Ionicons name="time" size={12} color={COLORS.accentDark}/><Text style={$.bPnT}>Under Review</Text></View>}
            {isRej&&<View style={$.bRj}><Ionicons name="close-circle" size={12} color={COLORS.danger}/><Text style={$.bRjT}>Declined</Text></View>}
          </View>
        )}
        {Boolean(isRej&&sub?.rejected_reason)&&<Text style={$.rejR}>"{sub.rejected_reason}"</Text>}

        {isSelfie&&samplePhotos.length>0&&(
          <View style={$.phSec}>
            <Text style={$.phSecT}>Reference Photos ({samplePhotos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10,paddingVertical:4}}>
              {samplePhotos.map((url,i)=>(
                <TouchableOpacity key={i} activeOpacity={0.85} onPress={()=>onPreview?.(samplePhotos,i)} style={$.phBox}>
                  <Image source={{uri:fixMediaUrl(url)}} style={$.phImg}/>
                  <LinearGradient colors={['transparent','rgba(0,0,0,0.6)']} style={$.phLbl}><Text style={$.phLblT}>Target {i+1}</Text></LinearGradient>
                </TouchableOpacity>
              ))}
              {Boolean(sub?.photo_url)&&(
                <TouchableOpacity activeOpacity={0.85} onPress={()=>onPreview?.([sub.photo_url],0)} style={[$.phBox,{borderColor:spot.completed?COLORS.success:COLORS.accent}]}>
                  <Image source={{uri:fixMediaUrl(sub.photo_url)}} style={$.phImg}/>
                  <LinearGradient colors={['transparent',spot.completed?'rgba(16,185,129,0.7)':'rgba(245,158,11,0.7)']} style={$.phLbl}><Text style={$.phLblT}>Yours</Text></LinearGradient>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}

        {spot.checkpoint_type==='sponsor_zone'&&spot.sponsors?.length>0&&(
          <View style={$.stSec}>
            <Text style={$.stSecT}>Sponsor Stalls ({spot.sponsors.length})</Text>
            <View style={$.stGrid}>
              {spot.sponsors.map(sp=>{
                const g=sGrad(sp.id);
                return(
                  <TouchableOpacity key={sp.id} activeOpacity={0.7} style={$.stGridCard} onPress={()=>onExploreZone?.(sp.id)}>
                    {sp.logo_url
                      ?<Image source={{uri:fixMediaUrl(sp.logo_url)}} style={$.stGridLogo} resizeMode="contain"/>
                      :<LinearGradient colors={g} style={$.stGridLogoFB}><Text style={$.stGridFBT}>{sp.name[0]}</Text></LinearGradient>}
                    <Text style={$.stGridName} numberOfLines={2}>{sp.name}</Text>
                    {Boolean(sp.stall_number)&&<Text style={$.stGridStall}>Stall {sp.stall_number}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={$.spActs}>
          <TouchableOpacity style={$.spDirBtn} activeOpacity={0.7} onPress={onNavigate}>
            <Ionicons name="navigate" size={15} color={COLORS.brand}/>
            <Text style={$.spDirT}>Directions</Text>
          </TouchableOpacity>
          {spot.checkpoint_type==='sponsor_zone'
            ?(spot.completed
              ?<View style={$.spDoneBtn}><Ionicons name="checkmark-done-circle" size={16} color={COLORS.success}/><Text style={$.spDoneT}>Completed</Text></View>
              :<View style={$.spAutoBtn}><Ionicons name="radio-outline" size={14} color={COLORS.brand}/><Text style={$.spAutoT}>Walk inside to auto check-in</Text></View>)
            :!spot.completed&&!isPend
              ?<TouchableOpacity style={[$.spCapBtn,(!isInside||isUploading)&&{opacity:0.45}]} disabled={!isInside||isUploading} activeOpacity={0.7} onPress={onCapture}>
                <LinearGradient colors={isInside?[COLORS.rose,'#be185d']:[COLORS.textTer,'#64748b']} style={$.spCapGrad}>
                  {isUploading?<ActivityIndicator color="#fff" size="small"/>:<><Ionicons name="camera" size={15} color="#fff"/><Text style={$.spCapT}>{isInside?'Take Selfie':'Get Closer'}</Text></>}
                </LinearGradient>
              </TouchableOpacity>
              :isPend
                ?<View style={$.spPendBtn}><Ionicons name="hourglass-outline" size={15} color={COLORS.accentDark}/><Text style={$.spPendT}>Under Review</Text></View>
                :<View style={$.spDoneBtn}><Ionicons name="checkmark-done-circle" size={16} color={COLORS.success}/><Text style={$.spDoneT}>Completed</Text></View>}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function MissionGridCard({spot,distance,isInside,onPress}){
  const isSelfie=spot.checkpoint_type==='selfie';
  const sub=spot.submission,isPend=sub?.status==='pending';
  const sc=useRef(new Animated.Value(1)).current;
  const displayImg=useMemo(()=>{
    if(sub?.photo_url)return sub.photo_url;
    if(spot.sample_photo_urls?.[0])return spot.sample_photo_urls[0];
    if(spot.sample_photo_url)return spot.sample_photo_url.split(',')[0].trim();
    return null;
  },[spot,sub]);

  return(
    <TouchableOpacity activeOpacity={1}
      onPressIn={()=>Animated.spring(sc,{toValue:0.96,friction:5,useNativeDriver:true}).start()}
      onPressOut={()=>Animated.spring(sc,{toValue:1,friction:4,useNativeDriver:true}).start()}
      onPress={onPress}>
      <Animated.View style={[$.gCard,{width:CARD_W,transform:[{scale:sc}]}]}>
        <View style={$.gImgWrap}>
          {displayImg
            ?<Image source={{uri:fixMediaUrl(displayImg)}} style={$.gImg}/>
            :<LinearGradient colors={sGrad(spot.id)} style={$.gImg} start={{x:0,y:0}} end={{x:1,y:1}}><Text style={{fontSize:44,textAlign:'center',marginTop:38}}>{isSelfie?'📸':'🏢'}</Text></LinearGradient>}
          <LinearGradient colors={['transparent','rgba(15,23,42,0.85)']} style={$.gOverlay} pointerEvents="none"/>
          <View style={$.gPtsBadge}><Ionicons name="trophy" size={10} color="#fff"/><Text style={$.gPtsT}>+{spot.points}</Text></View>
          <View style={$.gStatusRow}>
            {spot.completed&&<View style={[$.gStatusPill,{backgroundColor:COLORS.success}]}><Ionicons name="checkmark" size={10} color="#fff"/><Text style={$.gStatusT}>Done</Text></View>}
            {isPend&&<View style={[$.gStatusPill,{backgroundColor:COLORS.accent}]}><Ionicons name="time" size={10} color="#fff"/><Text style={$.gStatusT}>Review</Text></View>}
            {isInside&&!spot.completed&&<View style={[$.gStatusPill,{backgroundColor:COLORS.success}]}><View style={{width:5,height:5,borderRadius:2.5,backgroundColor:'#fff'}}/><Text style={$.gStatusT}>In Zone</Text></View>}
          </View>
          <View style={$.gBottom}>
            <Text style={$.gName} numberOfLines={2}>{spot.name}</Text>
            <View style={$.gDistRow}>
              <Ionicons name="location" size={10} color="rgba(255,255,255,0.85)"/>
              <Text style={$.gDist}>{isInside?(isSelfie?'In zone':'Inside'):distance!=null?`${formatDistance(distance)} · ${walkEta(distance)}`:'…'}</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function CheckpointScreen({tokens,onBack}){
  const [spots,setSpots]=useState([]);
  const [selfieOpen,setSelfieOpen]=useState(true);
  const [loading,setLoading]=useState(true);
  const [userLocation,setUserLocation]=useState(null);
  const [gpsStatus,setGpsStatus]=useState('locating');
  const [filterTab,setFilterTab]=useState('all');
  const [uploadingId,setUploadingId]=useState(null);
  const [selectedSpotId,setSelectedSpotId]=useState(null);
  const [galleryModal,setGalleryModal]=useState(null);
  const [detailSponsorId,setDetailSponsorId]=useState(null);
  const [toast,setToast]=useState(null);
  const [directionsUrl,setDirectionsUrl]=useState(null);
  const [destCoords,setDestCoords]=useState(null);

  const webViewRef=useRef(null);
  const locSubRef=useRef(null);
  const locHistRef=useRef([]);
  const autoRef=useRef({});
  const mapCenteredRef=useRef(false);
  const spotsRef=useRef([]);
  useEffect(()=>{spotsRef.current=spots},[spots]);

  // SMART BACK HANDLER OVERRIDE
  const handleHardwareBack = useCallback(() => {
    if (directionsUrl) { setDirectionsUrl(null); return true; }
    if (detailSponsorId) { setDetailSponsorId(null); return true; }
    if (selectedSpotId) {
      setSelectedSpotId(null);
      webViewRef.current?.injectJavaScript('window.clearRoute&&window.clearRoute();true;');
      return true;
    }
    return false;
  }, [directionsUrl, detailSponsorId, selectedSpotId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => sub.remove();
  }, [handleHardwareBack]);

  const sheetY=useRef(new Animated.Value(H-SNAP_COLLAPSED)).current;
  const curSnap=useRef(SNAP_COLLAPSED);
  const hudOpacity=sheetY.interpolate({inputRange:[H-SNAP_FULL,H-SNAP_HALF,H-SNAP_COLLAPSED],outputRange:[0,0.5,1],extrapolate:'clamp'});

  const snapTo=useCallback((t)=>{
    curSnap.current=t;
    Animated.spring(sheetY,{toValue:H-t,friction:8,tension:70,useNativeDriver:false}).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
  },[sheetY]);

  const panR=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>false,
    onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dy)>10&&Math.abs(g.dy)>Math.abs(g.dx),
    onPanResponderGrant:()=>{sheetY.setOffset(H-curSnap.current);sheetY.setValue(0)},
    onPanResponderMove:Animated.event([null,{dy:sheetY}],{useNativeDriver:false}),
    onPanResponderRelease:(_,g)=>{
      sheetY.flattenOffset();
      const cur=H-curSnap.current+g.dy;
      let target;
      if (g.vy > 1.2) target = SNAP_COLLAPSED; 
      else if (g.vy < -1.2) target = SNAP_FULL;
      else {
        const dists = [
          { t: SNAP_COLLAPSED, d: Math.abs(cur - (H - SNAP_COLLAPSED)) },
          { t: SNAP_HALF, d: Math.abs(cur - (H - SNAP_HALF)) },
          { t: SNAP_FULL, d: Math.abs(cur - (H - SNAP_FULL)) },
        ];
        dists.sort((a,b) => a.d - b.d);
        target = dists[0].t;
      }
      snapTo(target);
    },
  })).current;

  const fetchSpots=useCallback(async()=>{
    try{
      const r=await apiFetch('/photos/checkpoints/');
      if(r.ok){const d=await r.json();setSpots(d.points||[]);if(d.selfie_upload_open!==undefined)setSelfieOpen(d.selfie_upload_open)}
    }catch{}finally{setLoading(false)}
  },[]);

  const smoothLoc=(c)=>{
    if(c.accuracy&&c.accuracy>35)return null;
    const h=locHistRef.current;h.push({lat:c.latitude,lng:c.longitude});if(h.length>3)h.shift();
    return{latitude:h.reduce((s,p)=>s+p.lat,0)/h.length,longitude:h.reduce((s,p)=>s+p.lng,0)/h.length,accuracy:c.accuracy};
  };

  const startLoc=useCallback(async()=>{
    try{
      const{status}=await Location.requestForegroundPermissionsAsync();
      if(status!=='granted'){setGpsStatus('denied');return}
      const last=await Location.getLastKnownPositionAsync({});
      if(last?.coords){
        setUserLocation({latitude:last.coords.latitude,longitude:last.coords.longitude,accuracy:last.coords.accuracy});
        setGpsStatus('ready');
      }
      locSubRef.current=await Location.watchPositionAsync(
        {accuracy:Location.Accuracy.BestForNavigation,distanceInterval:2,timeInterval:2500},
        (loc)=>{
          if(!loc?.coords)return;
          const sm=smoothLoc(loc.coords);
          if(!sm)return;
          setUserLocation(sm);setGpsStatus('ready');
          webViewRef.current?.injectJavaScript(`window.uLoc&&window.uLoc(${sm.latitude},${sm.longitude});true;`);
          if(!mapCenteredRef.current){mapCenteredRef.current=true;webViewRef.current?.injectJavaScript(`window.cMe&&window.cMe(${sm.latitude},${sm.longitude});true;`)}
        }
      );
    }catch{setGpsStatus('denied')}
  },[]);

  useEffect(()=>{fetchSpots();startLoc();return()=>locSubRef.current?.remove()},[]);

  useEffect(()=>{
    if(userLocation&&!mapCenteredRef.current){
      mapCenteredRef.current=true;
      webViewRef.current?.injectJavaScript(`window.cMe&&window.cMe(${userLocation.latitude},${userLocation.longitude});true;`);
    }
  },[userLocation]);

  useEffect(()=>{
    if(!userLocation||!selfieOpen)return;
    spots.forEach(sp=>{
      if(sp.checkpoint_type!=='sponsor_zone'||sp.completed||sp.submission||autoRef.current[sp.id])return;
      if(!isInsideCorridor(userLocation.latitude,userLocation.longitude,sp.point_a_lat,sp.point_a_lng,sp.point_b_lat,sp.point_b_lng,sp.corridor_width_meters))return;
      autoRef.current[sp.id]=true;
      (async()=>{
        try{
          const f=new FormData();f.append('selfie_point_id',sp.id);f.append('user_latitude',String(userLocation.latitude));f.append('user_longitude',String(userLocation.longitude));
          const r=await apiFetch('/photos/checkpoint-visit/',{method:'POST',body:f});const d=await r.json();
          if(r.ok){Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});setToast({message:`${sp.name}! +${d.points_awarded||10} pts`,icon:'🎉',color:COLORS.success});fetchSpots()}
        }catch{}
      })();
    });
  },[userLocation,spots,selfieOpen]);

  const getDist=useCallback((sp)=>{
    if(!userLocation)return null;
    if(sp.checkpoint_type==='selfie')return getHaversineDistanceMeters(userLocation.latitude,userLocation.longitude,sp.latitude,sp.longitude);
    const mLat=(sp.point_a_lat+sp.point_b_lat)/2,mLng=(sp.point_a_lng+sp.point_b_lng)/2;
    return getHaversineDistanceMeters(userLocation.latitude,userLocation.longitude,mLat,mLng);
  },[userLocation]);

  const completedCount=useMemo(()=>spots.filter(s=>s.completed).length,[spots]);
  const selectedSpot=useMemo(()=>selectedSpotId?spots.find(s=>s.id===selectedSpotId):null,[spots,selectedSpotId]);
  const displaySpots=useMemo(()=>{
    let f=spots;
    if(filterTab==='selfie')f=spots.filter(s=>s.checkpoint_type==='selfie');
    else if(filterTab==='sponsor')f=spots.filter(s=>s.checkpoint_type==='sponsor_zone');
    else if(filterTab==='completed')f=spots.filter(s=>s.completed);
    return[...f].sort((a,b)=>{
      if(a.completed!==b.completed)return a.completed?1:-1;
      const da=getDist(a),db=getDist(b);if(da!=null&&db!=null)return da-db;return 0;
    });
  },[spots,filterTab,getDist]);

  const nearestLabel=useMemo(()=>{
    if(!userLocation)return spots.length-completedCount>0?`${spots.length-completedCount} missions`:null;
    let best=null,bestD=Infinity;
    spots.forEach(s=>{if(s.completed)return;const d=getDist(s);if(d!=null&&d<bestD){bestD=d;best=s}});
    if(!best)return spots.length>0?'🏆 All complete!':null;
    return`Nearest: ${best.name} · ${formatDistance(bestD)}`;
  },[spots,completedCount,userLocation,getDist]);

  const spotKey=useMemo(()=>spots.map(s=>s.id).join(','),[spots]);
  const leafletHTML=useMemo(()=>{
    const sj=JSON.stringify(spots.map(s=>({
      id:s.id,n:s.name,tp:s.checkpoint_type,lat:s.latitude,lng:s.longitude,r:s.radius_meters,
      pa:s.point_a_lat,qa:s.point_a_lng,pb:s.point_b_lat,qb:s.point_b_lng,cw:s.corridor_width_meters,
      dn:s.completed,pt:s.points,sc:(s.sponsors||[]).length
    })));
    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}html,body,#map{height:100%;width:100%}
.leaflet-control-attribution,.leaflet-control-zoom{display:none!important}
@keyframes pulse{0%{transform:scale(1);opacity:.6}50%{transform:scale(2.5);opacity:0}100%{transform:scale(1);opacity:0}}
@keyframes bounce{0%{transform:scale(0)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
.um{position:relative;width:20px;height:20px}
.ud{width:14px;height:14px;border-radius:50%;background:#0284c7;border:3px solid #fff;position:absolute;top:3px;left:3px;z-index:2;box-shadow:0 0 8px rgba(2,132,199,.6)}
.ur{width:20px;height:20px;border-radius:50%;border:2px solid rgba(2,132,199,.4);position:absolute;animation:pulse 2s infinite}
.p{width:36px;height:36px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2.5px solid #fff;cursor:pointer;animation:bounce .4s ease-out;box-shadow:0 2px 10px rgba(0,0,0,.2)}
.p.s{background:linear-gradient(135deg,#f43f5e,#be185d)}
.p.z{background:linear-gradient(135deg,#0333b6,#06b6d4);width:40px;height:40px;border-radius:20px}
.p.d{background:linear-gradient(135deg,#10b981,#047857)}
.pl{position:absolute;top:100%;left:50%;transform:translateX(-50%);white-space:nowrap;font:800 9px/1 -apple-system,sans-serif;color:#0f172a;background:rgba(255,255,255,.95);padding:2px 5px;border-radius:5px;margin-top:2px;box-shadow:0 1px 3px rgba(0,0,0,.12);pointer-events:none;max-width:80px;overflow:hidden;text-overflow:ellipsis}
</style></head><body><div id="map"></div>
<script>
var S=${sj},map=L.map('map',{zoomControl:false,attributionControl:false}).setView([28.5456,77.1923],16),um=null,rLine=null,rLabel=null;
L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{maxZoom:20,subdomains:['mt0','mt1','mt2','mt3'],attribution:'&copy; Google Maps'}).addTo(map);
var B=[];
S.forEach(function(s,i){
  var c=s.dn?'d':s.tp==='selfie'?'s':'z',e=s.dn?'✓':s.tp==='selfie'?'📸':'🏢';
  if(s.tp==='selfie'&&s.lat){
    var sz=36,h='<div style="position:relative"><div class="p '+c+'">'+e+'</div><div class="pl">'+s.n+'</div></div>';
    L.marker([s.lat,s.lng],{icon:L.divIcon({html:h,className:'',iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]})}).addTo(map).on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({t:'S',id:s.id}))});
    L.circle([s.lat,s.lng],{color:s.dn?'#10b981':'#f43f5e',fillColor:s.dn?'#10b981':'#f43f5e',fillOpacity:.07,radius:s.r,weight:1.5,dashArray:s.dn?'':'5,5'}).addTo(map);
    B.push([s.lat,s.lng]);
  }else if(s.tp==='sponsor_zone'&&s.pa&&s.pb){
    var m=[(s.pa+s.pb)/2,(s.qa+s.qb)/2],sz=40;
    var badge=s.sc?'<span style="font-size:7px;position:absolute;bottom:-1px;right:-2px;background:#fff;color:#0333b6;border-radius:8px;padding:0 3px;font-weight:900">'+s.sc+'</span>':'';
    var h='<div style="position:relative"><div class="p '+c+'">'+e+badge+'</div><div class="pl">'+s.n+'</div></div>';
    L.marker(m,{icon:L.divIcon({html:h,className:'',iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]})}).addTo(map).on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({t:'S',id:s.id}))});
    L.polyline([[s.pa,s.qa],[s.pb,s.qb]],{color:s.dn?'#10b981':'#0333b6',weight:8,opacity:.25}).addTo(map);
    L.polyline([[s.pa,s.qa],[s.pb,s.qb]],{color:s.dn?'#10b981':'#06b6d4',weight:2.5,opacity:.9,dashArray:'7,5'}).addTo(map);
    B.push(m);
  }
});
if(B.length)try{map.fitBounds(B,{padding:[40,40],maxZoom:17})}catch(e){}
window.uLoc=function(a,b){
  if(!um){var h='<div class="um"><div class="ur"></div><div class="ud"></div></div>';um=L.marker([a,b],{icon:L.divIcon({html:h,className:'',iconSize:[20,20],iconAnchor:[10,10]}),zIndexOffset:1000}).addTo(map)}
  else um.setLatLng([a,b]);
};
window.cMe=function(a,b){map.flyTo([a,b],17,{duration:1.2})};
window.fSpot=function(a,b){map.flyTo([a,b],18,{duration:.7})};
window.drawRoute=function(ulat,ulng,dlat,dlng,lbl){
  if(rLine)map.removeLayer(rLine);if(rLabel)map.removeLayer(rLabel);
  rLine=L.polyline([[ulat,ulng],[dlat,dlng]],{color:'#f59e0b',weight:3,dashArray:'8,6',opacity:.9}).addTo(map);
  var mid=[(ulat+dlat)/2,(ulng+dlng)/2];
  rLabel=L.marker(mid,{icon:L.divIcon({html:'<div style="background:#fff;color:#0f172a;font:800 10px/1 -apple-system,sans-serif;padding:3px 8px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.15);white-space:nowrap">'+lbl+'</div>',className:'',iconSize:[90,20],iconAnchor:[45,10]})}).addTo(map);
};
window.clearRoute=function(){if(rLine){map.removeLayer(rLine);rLine=null}if(rLabel){map.removeLayer(rLabel);rLabel=null}};
<\/script></body></html>`;
  },[spotKey]);

  const onMapMsg=useCallback((e)=>{
    try{
      const d=JSON.parse(e.nativeEvent.data);
      if(d.t==='S'){
        setSelectedSpotId(d.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
        snapTo(SNAP_COLLAPSED);
        const sp=spotsRef.current.find(s=>s.id===d.id);
        if(sp){const lat=sp.latitude||(sp.point_a_lat+sp.point_b_lat)/2,lng=sp.longitude||(sp.point_a_lng+sp.point_b_lng)/2;webViewRef.current?.injectJavaScript(`window.fSpot&&window.fSpot(${lat},${lng});true;`)}
      }
    }catch{}
  },[snapTo]);

  const handleRecenter=useCallback(()=>{
    if(userLocation){webViewRef.current?.injectJavaScript(`window.cMe&&window.cMe(${userLocation.latitude},${userLocation.longitude});true;`);Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{})}
  },[userLocation]);

  const handleNavigate=useCallback((spot)=>{
    const dLat=spot.latitude||(spot.point_a_lat!=null?(spot.point_a_lat+spot.point_b_lat)/2:null);
    const dLng=spot.longitude||(spot.point_a_lng!=null?(spot.point_a_lng+spot.point_b_lng)/2:null);
    if(!dLat||!dLng)return;
    const origin=userLocation?`${userLocation.latitude},${userLocation.longitude}`:'';
    setDestCoords({latitude:dLat,longitude:dLng});
    setDirectionsUrl(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dLat},${dLng}&travelmode=walking`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
  },[userLocation]);

  const handleOpenGoogleMapsApp=useCallback(()=>{
    if(!destCoords)return;
    const origin=userLocation?`${userLocation.latitude},${userLocation.longitude}`:'';
    const appUrl=Platform.select({
      ios:`maps://app?saddr=${origin}&daddr=${destCoords.latitude},${destCoords.longitude}&dirflg=w`,
      android:`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destCoords.latitude},${destCoords.longitude}&travelmode=walking`
    });
    Linking.openURL(appUrl).catch(()=>{
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destCoords.latitude},${destCoords.longitude}&travelmode=walking`);
    });
  },[destCoords,userLocation]);

  const handleTakeSelfie=useCallback(async(spot)=>{
    if(!selfieOpen){Alert.alert('Closed','Checkpoint challenges are currently closed.');return}
    if(!userLocation){Alert.alert('GPS Required','Waiting for GPS signal.');return}
    const dist=getHaversineDistanceMeters(userLocation.latitude,userLocation.longitude,spot.latitude,spot.longitude);
    if(dist!=null&&dist>spot.radius_meters){Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{});Alert.alert('Outside Zone',`You're ${Math.round(dist)}m away. Get within ${spot.radius_meters}m.`);return}
    const perm=await ImagePicker.requestCameraPermissionsAsync();
    if(!perm.granted){Alert.alert('Camera','Allow camera access.');return}
    const result=await ImagePicker.launchCameraAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:0.8,allowsEditing:true,aspect:[1,1]});
    if(result.canceled||!result.assets?.[0])return;
    const asset=result.assets[0];setUploadingId(spot.id);
    try{
      const f=new FormData();f.append('selfie_point_id',spot.id);f.append('user_latitude',String(userLocation.latitude));f.append('user_longitude',String(userLocation.longitude));
      if(Platform.OS==='web'&&asset.file)f.append('image',asset.file,'selfie.jpg');else f.append('image',{uri:asset.uri,type:asset.mimeType||'image/jpeg',name:'selfie.jpg'});
      const r=await apiFetch('/photos/checkpoint-visit/',{method:'POST',body:f});const d=await r.json();
      if(!r.ok){Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(()=>{});Alert.alert('Failed',d.error||'Try again.');return}
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      setToast({message:'Selfie submitted! Pending approval.',icon:'📤',color:COLORS.brand});
      setSelectedSpotId(null);fetchSpots();
    }catch{Alert.alert('Error','Upload failed.')}finally{setUploadingId(null)}
  },[userLocation,selfieOpen,fetchSpots]);

  if(detailSponsorId)return<SponsorDetailScreen sponsorId={detailSponsorId} onBack={()=>setDetailSponsorId(null)}/>;

  const FILTERS=[
    {key:'all',icon:'compass-outline',label:'All',ct:spots.length},
    {key:'selfie',icon:'camera-outline',label:'Selfie',ct:spots.filter(s=>s.checkpoint_type==='selfie').length},
    {key:'sponsor',icon:'storefront-outline',label:'Sponsors',ct:spots.filter(s=>s.checkpoint_type==='sponsor_zone').length},
    {key:'completed',icon:'checkmark-done-outline',label:'Done',ct:completedCount},
  ];

  const selDist=selectedSpot?getDist(selectedSpot):null;
  const selInside=selectedSpot&&userLocation&&(
    selectedSpot.checkpoint_type==='selfie'
      ?(selDist!=null&&selDist<=selectedSpot.radius_meters)
      :isInsideCorridor(userLocation.latitude,userLocation.longitude,selectedSpot.point_a_lat,selectedSpot.point_a_lng,selectedSpot.point_b_lat,selectedSpot.point_b_lng,selectedSpot.corridor_width_meters)
  );

  const rows=[];
  for(let i=0;i<displaySpots.length;i+=2)rows.push([displaySpots[i],displaySpots[i+1]]);

  return(
    <View style={$.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent"/>

      {/* MAP */}
      <View style={$.mapFull}>
        {loading
          ?<View style={$.loadW}><LinearGradient colors={[COLORS.bg,COLORS.bgAlt]} style={StyleSheet.absoluteFill}/><View style={$.loadR}><Ionicons name="radio-outline" size={28} color={COLORS.brand}/></View><Text style={$.loadT}>Loading map…</Text></View>
          :<WebView ref={webViewRef} originWhitelist={['*']} source={{html:leafletHTML}} style={StyleSheet.absoluteFill} onMessage={onMapMsg} scrollEnabled={false} bounces={false} javaScriptEnabled domStorageEnabled overScrollMode="never" renderLoading={()=><View style={$.loadW}><ActivityIndicator color={COLORS.brand}/></View>}/>}
      </View>

      {/* TOP BAR */}
      <View style={$.topBar}>
        <GlassBtn onPress={() => { if(handleHardwareBack()) return; onBack(); }}>
            <Ionicons name="chevron-back" size={20} color={COLORS.text}/>
        </GlassBtn>
        <View style={$.gpsPill}>
          <GpsPulse status={gpsStatus}/>
          <Text style={$.gpsLbl}>{gpsStatus==='ready'?'GPS LIVE':gpsStatus==='locating'?'FINDING…':'GPS OFF'}</Text>
          {gpsStatus==='ready'&&userLocation?.accuracy&&<Text style={$.gpsAcc}>±{Math.round(userLocation.accuracy)}m</Text>}
        </View>
      </View>

      <Animated.View style={[$.rightC,{opacity:hudOpacity}]} pointerEvents="box-none">
        <GlassBtn onPress={handleRecenter} size={38}><Ionicons name="locate" size={17} color={COLORS.brand}/></GlassBtn>
      </Animated.View>

      {!loading&&<QuestHUD done={completedCount} total={spots.length} selfieOpen={selfieOpen} opacity={hudOpacity}/>}

      {/* SPOT DETAIL PANEL */}
      {selectedSpot&&(
        <SpotDetailPanel
          spot={selectedSpot} distance={selDist} isInside={selInside}
          isUploading={uploadingId===selectedSpotId}
          onClose={()=>{setSelectedSpotId(null);webViewRef.current?.injectJavaScript('window.clearRoute&&window.clearRoute();true;')}}
          onCapture={()=>handleTakeSelfie(selectedSpot)}
          onNavigate={()=>handleNavigate(selectedSpot)}
          onExploreZone={(id)=>{setSelectedSpotId(null);setDetailSponsorId(id)}}
          onPreview={(imgs,idx)=>setGalleryModal({images:imgs,index:idx})}
        />
      )}

      {/* BOTTOM DRAWER SHEET */}
      {!loading&&!selectedSpot&&(
        <Animated.View style={[$.sheet,{top:sheetY}]}>
          <View {...panR.panHandlers}>
            <View style={$.shDrag}><View style={$.shBar}/></View>
            <TouchableOpacity activeOpacity={0.9} onPress={()=>{const next=curSnap.current===SNAP_COLLAPSED?SNAP_HALF:curSnap.current===SNAP_HALF?SNAP_FULL:SNAP_COLLAPSED;snapTo(next)}} style={$.shHdrBtn}>
              <View style={$.shHdrRow}>
                <View style={{flexDirection:'row',alignItems:'center',gap:7,flex:1}}>
                  <Ionicons name="flash" size={15} color={COLORS.accent}/>
                  <Text style={$.shTitle} numberOfLines={1}>{nearestLabel||'Loading…'}</Text>
                </View>
                <Ionicons name={curSnap.current===SNAP_FULL?'chevron-down':'chevron-up'} size={16} color={COLORS.textTer}/>
              </View>
            </TouchableOpacity>
          </View>
          <View style={$.shBody}>
            <View style={$.filterWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={$.filterScroll}>
                {FILTERS.map(f=>{const a=filterTab===f.key;return(
                  <TouchableOpacity key={f.key} onPress={()=>{setFilterTab(f.key);Haptics.selectionAsync().catch(()=>{})}} style={[$.fPill,a&&$.fPillA]} activeOpacity={0.7}>
                    <Ionicons name={f.icon} size={12} color={a?'#fff':COLORS.textSec}/>
                    <Text style={[$.fText,a&&$.fTextA]}>{f.label}</Text>
                    <View style={[$.fBadge,a&&$.fBadgeA]}><Text style={[$.fBadgeT,a&&{color:COLORS.brand}]}>{f.ct}</Text></View>
                  </TouchableOpacity>
                )})}
              </ScrollView>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{paddingHorizontal:16,paddingBottom:BOTTOM_INSET+140}}>
              {rows.length===0
                ?<View style={$.emW}><View style={$.emIc}><Ionicons name="telescope-outline" size={30} color={COLORS.textTer}/></View><Text style={$.emT}>No checkpoints match</Text></View>
                :rows.map((row,ri)=>(
                  <View key={ri} style={{flexDirection:'row',gap:GRID_GAP,marginBottom:GRID_GAP}}>
                    {row.map(spot=>{
                      if(!spot)return<View key="empty" style={{width:CARD_W}}/>;
                      const dist=getDist(spot);
                      const inside=userLocation&&(spot.checkpoint_type==='selfie'?(dist!=null&&dist<=spot.radius_meters):isInsideCorridor(userLocation.latitude,userLocation.longitude,spot.point_a_lat,spot.point_a_lng,spot.point_b_lat,spot.point_b_lng,spot.corridor_width_meters));
                      return<MissionGridCard key={spot.id} spot={spot} distance={dist} isInside={inside} onPress={()=>{
                        setSelectedSpotId(spot.id);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
                        const lat=spot.latitude||(spot.point_a_lat+spot.point_b_lat)/2,lng=spot.longitude||(spot.point_a_lng+spot.point_b_lng)/2;
                        webViewRef.current?.injectJavaScript(`window.fSpot&&window.fSpot(${lat},${lng});true;`);
                      }}/>;
                    })}
                  </View>
                ))}
            </ScrollView>
          </View>
        </Animated.View>
      )}

      <FloatingToast {...(toast||{})} visible={!!toast} onHide={()=>setToast(null)}/>
      {galleryModal&&<ImageZoomModal images={galleryModal.images} initialIndex={galleryModal.index} onClose={()=>setGalleryModal(null)}/>}

      {/* FULL IN-APP GOOGLE MAPS DIRECTIONS */}
      {directionsUrl&&(
        <Modal animationType="slide" visible onRequestClose={()=>setDirectionsUrl(null)}>
          <View style={{flex:1,backgroundColor:COLORS.bg}}>
            <View style={$.dirBar}>
              <TouchableOpacity onPress={()=>setDirectionsUrl(null)} hitSlop={{top:12,bottom:12,left:12,right:12}}><Ionicons name="arrow-back" size={22} color={COLORS.text}/></TouchableOpacity>
              <Text style={$.dirTitle}>In-App Navigation</Text>
              <TouchableOpacity style={$.dirAppBtn} activeOpacity={0.8} onPress={handleOpenGoogleMapsApp}>
                <Ionicons name="logo-google" size={14} color={COLORS.brand} />
                <Text style={$.dirAppTxt}>Open App</Text>
              </TouchableOpacity>
            </View>
            <WebView
              source={{uri:directionsUrl}}
              injectedJavaScript={INJECT_HIDE_PROMO}
              startInLoadingState
              renderLoading={()=><View style={$.loadW}><ActivityIndicator color={COLORS.brand}/></View>}
              style={{flex:1}}
              javaScriptEnabled
              domStorageEnabled
              geolocationEnabled
              onShouldStartLoadWithRequest={(req)=>{
                const url=req.url||'';
                if(url.startsWith('intent://')||url.startsWith('comgooglemaps://')||url.startsWith('comgooglemapsurl://')||url.startsWith('market://'))return false;
                return true;
              }}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const $=StyleSheet.create({
  root:{flex:1,backgroundColor:COLORS.bg},
  mapFull:{...StyleSheet.absoluteFillObject},
  loadW:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:COLORS.bg},
  loadR:{width:64,height:64,borderRadius:32,backgroundColor:COLORS.brandLight,alignItems:'center',justifyContent:'center',marginBottom:12},
  loadT:{fontSize:FONT.md,fontWeight:FONT.w7,color:COLORS.textSec},

  topBar:{position:'absolute',top:TOP_INSET,left:16,right:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center',zIndex:30},
  glassBtn:{backgroundColor:'rgba(255,255,255,0.95)',alignItems:'center',justifyContent:'center',...SHADOW.md,borderWidth:1,borderColor:'rgba(255,255,255,0.6)'},
  gpsPill:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'rgba(255,255,255,0.95)',paddingHorizontal:12,paddingVertical:7,borderRadius:RADIUS.full,...SHADOW.sm,borderWidth:1,borderColor:'rgba(255,255,255,0.6)'},
  gpsLbl:{fontSize:FONT.micro,fontWeight:FONT.w9,color:COLORS.text,letterSpacing:0.8},
  gpsAcc:{fontSize:FONT.micro,color:COLORS.textTer,fontWeight:FONT.w6},
  rightC:{position:'absolute',top:TOP_INSET+56,right:16,zIndex:20},

  questHud:{position:'absolute',top:TOP_INSET+56,left:16,zIndex:20},
  questI:{backgroundColor:'rgba(255,255,255,0.95)',borderRadius:RADIUS.full,paddingHorizontal:12,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:8,...SHADOW.md,borderWidth:1,borderColor:'rgba(255,255,255,0.7)'},
  questDot:{width:7,height:7,borderRadius:3.5},
  questL:{fontSize:FONT.xs,fontWeight:FONT.w8,color:COLORS.text},
  questBar:{width:60,height:3,backgroundColor:COLORS.border,borderRadius:2,overflow:'hidden'},
  questF:{height:3,borderRadius:2},
  wDot:{width:6,height:6,borderRadius:3},

  spPanel:{position:'absolute',bottom:0,left:0,right:0,maxHeight:H*0.78,backgroundColor:'#fff',borderTopLeftRadius:RADIUS.xxl,borderTopRightRadius:RADIUS.xxl,...SHADOW.xl,zIndex:50},
  spHandleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',height:54},
  spBar:{width:44,height:5,borderRadius:3,backgroundColor:COLORS.border},
  spClose:{paddingRight:20},
  spTypePill:{alignSelf:'flex-start',paddingHorizontal:10,paddingVertical:4,borderRadius:RADIUS.sm,marginBottom:8},
  spTypeT:{fontSize:FONT.xs,fontWeight:FONT.w8},
  spName:{fontSize:FONT.xl,fontWeight:FONT.w9,color:COLORS.text},
  spDesc:{fontSize:FONT.sm,color:COLORS.textSec,marginTop:4,lineHeight:20},
  spMeta:{flexDirection:'row',alignItems:'center',gap:12,marginTop:12},
  spPts:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:COLORS.accentLight,paddingHorizontal:10,paddingVertical:5,borderRadius:RADIUS.sm},
  spPtsT:{fontSize:FONT.sm,fontWeight:FONT.w8,color:COLORS.accentDark},
  spRad:{fontSize:FONT.xs,color:COLORS.textTer},
  spProx:{marginTop:14,backgroundColor:COLORS.bgAlt,borderRadius:RADIUS.md,padding:12},
  proxTrack:{height:4,backgroundColor:COLORS.border,borderRadius:2,overflow:'hidden'},
  proxFill:{height:4,borderRadius:2},
  proxLbl:{fontSize:FONT.sm,fontWeight:FONT.w7,color:COLORS.textSec,marginTop:8},
  bDn:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:COLORS.successLight,paddingHorizontal:7,paddingVertical:3,borderRadius:6},
  bDnT:{fontSize:FONT.micro,fontWeight:FONT.w8,color:COLORS.success},
  bPn:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:COLORS.warningLight,paddingHorizontal:7,paddingVertical:3,borderRadius:6},
  bPnT:{fontSize:FONT.micro,fontWeight:FONT.w8,color:COLORS.accentDark},
  bRj:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:COLORS.errorLight,paddingHorizontal:7,paddingVertical:3,borderRadius:6},
  bRjT:{fontSize:FONT.micro,fontWeight:FONT.w8,color:COLORS.danger},
  rejR:{fontSize:FONT.xs,color:COLORS.danger,marginTop:6,fontStyle:'italic'},

  phSec:{marginTop:14},
  phSecT:{fontSize:FONT.sm,fontWeight:FONT.w8,color:COLORS.textSec,marginBottom:6},
  phBox:{width:90,height:90,borderRadius:RADIUS.md,overflow:'hidden',borderWidth:1.5,borderColor:COLORS.border,backgroundColor:'#fff'},
  phImg:{width:'100%',height:'100%'},
  phLbl:{position:'absolute',bottom:0,left:0,right:0,paddingVertical:3,alignItems:'center'},
  phLblT:{fontSize:8,fontWeight:FONT.w8,color:'#fff'},

  stSec:{marginTop:18},
  stSecT:{fontSize:FONT.base,fontWeight:FONT.w9,color:COLORS.text,marginBottom:10},
  stGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  stGridCard:{width:(W-32-16)/3,backgroundColor:'#fff',borderRadius:RADIUS.lg,padding:10,alignItems:'center',...SHADOW.md},
  stGridLogo:{width:72,height:72,borderRadius:RADIUS.md,backgroundColor:'#fff'},
  stGridLogoFB:{width:72,height:72,borderRadius:RADIUS.md,alignItems:'center',justifyContent:'center'},
  stGridFBT:{fontWeight:FONT.w9,color:'#fff',fontSize:22},
  stGridName:{fontSize:FONT.xs,fontWeight:FONT.w8,color:COLORS.text,marginTop:6,textAlign:'center'},
  stGridStall:{fontSize:8,fontWeight:FONT.w7,color:COLORS.brand,marginTop:2,textAlign:'center'},

  spActs:{flexDirection:'row',gap:10,marginTop:18},
  spDirBtn:{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:12,paddingHorizontal:14,borderRadius:RADIUS.md,backgroundColor:COLORS.brandLight},
  spDirT:{fontSize:FONT.sm,fontWeight:FONT.w7,color:COLORS.brand},
  spCapBtn:{flex:1,borderRadius:RADIUS.md,overflow:'hidden'},
  spCapGrad:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:12},
  spCapT:{fontSize:FONT.sm,fontWeight:FONT.w8,color:'#fff'},
  spPendBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,backgroundColor:COLORS.warningLight,borderRadius:RADIUS.md,paddingVertical:12},
  spPendT:{fontSize:FONT.sm,fontWeight:FONT.w7,color:COLORS.accentDark},
  spDoneBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,backgroundColor:COLORS.successLight,borderRadius:RADIUS.md,paddingVertical:12},
  spDoneT:{fontSize:FONT.sm,fontWeight:FONT.w7,color:COLORS.success},
  spAutoBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,backgroundColor:COLORS.brandLight,borderRadius:RADIUS.md,paddingVertical:12,paddingHorizontal:8},
  spAutoT:{fontSize:FONT.xs,fontWeight:FONT.w6,color:COLORS.brand},

  sheet:{position:'absolute',left:0,right:0,height:SNAP_FULL,backgroundColor:'rgba(255,255,255,0.98)',borderTopLeftRadius:RADIUS.xxl,borderTopRightRadius:RADIUS.xxl,...SHADOW.xl,zIndex:40},
  shDrag:{alignItems:'center',paddingTop:14,paddingBottom:10,backgroundColor:'transparent'},
  shBar:{width:44,height:5,borderRadius:3,backgroundColor:COLORS.border},
  shBody:{flex:1},
  shHdrBtn:{paddingHorizontal:16,paddingBottom:10},
  shHdrRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  shTitle:{fontSize:FONT.sm,fontWeight:FONT.w8,color:COLORS.text},

  filterWrap:{marginTop:2,marginBottom:8},
  filterScroll:{paddingHorizontal:16,alignItems:'center',gap:6},
  fPill:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:10,paddingVertical:7,borderRadius:RADIUS.md,backgroundColor:COLORS.surface,borderWidth:1,borderColor:COLORS.border},
  fPillA:{backgroundColor:COLORS.brand,borderColor:COLORS.brand},
  fText:{fontSize:FONT.xs,fontWeight:FONT.w7,color:COLORS.textSec},
  fTextA:{color:'#fff'},
  fBadge:{backgroundColor:COLORS.bgAlt,paddingHorizontal:5,paddingVertical:1,borderRadius:5,minWidth:18,alignItems:'center'},
  fBadgeA:{backgroundColor:'rgba(255,255,255,0.25)'},
  fBadgeT:{fontSize:FONT.micro,fontWeight:FONT.w8,color:COLORS.textSec},

  gCard:{borderRadius:RADIUS.lg,overflow:'hidden',backgroundColor:COLORS.surface,...SHADOW.md},
  gImgWrap:{width:'100%',height:180,position:'relative',backgroundColor:COLORS.bgAlt},
  gImg:{width:'100%',height:'100%'},
  gOverlay:{position:'absolute',left:0,right:0,bottom:0,height:'55%'},
  gPtsBadge:{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(15,23,42,0.75)',paddingHorizontal:7,paddingVertical:3,borderRadius:RADIUS.full},
  gPtsT:{fontSize:FONT.micro,fontWeight:FONT.w9,color:'#fff'},
  gStatusRow:{position:'absolute',top:8,left:8,flexDirection:'row',gap:4,flexWrap:'wrap',maxWidth:'65%'},
  gStatusPill:{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:3,borderRadius:RADIUS.full},
  gStatusT:{fontSize:8,fontWeight:FONT.w9,color:'#fff'},
  gBottom:{position:'absolute',left:0,right:0,bottom:0,padding:10},
  gName:{fontSize:FONT.sm,fontWeight:FONT.w9,color:'#fff',textShadowColor:'rgba(0,0,0,0.4)',textShadowOffset:{width:0,height:1},textShadowRadius:3},
  gDistRow:{flexDirection:'row',alignItems:'center',gap:3,marginTop:3},
  gDist:{fontSize:FONT.xs,color:'rgba(255,255,255,0.9)',fontWeight:FONT.w7},

  emW:{alignItems:'center',paddingVertical:48,gap:8},
  emIc:{width:52,height:52,borderRadius:26,backgroundColor:COLORS.bgAlt,alignItems:'center',justifyContent:'center'},
  emT:{fontSize:FONT.sm,fontWeight:FONT.w7,color:COLORS.textSec},

  toastW:{position:'absolute',top:TOP_INSET+4,left:16,right:16,zIndex:100},
  toastI:{backgroundColor:'rgba(255,255,255,0.97)',borderRadius:RADIUS.lg,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:10,borderLeftWidth:4,...SHADOW.lg},
  toastT:{fontSize:FONT.sm,fontWeight:FONT.w7,color:COLORS.text,flex:1},

  pvBg:{flex:1,backgroundColor:'rgba(0,0,0,0.93)',justifyContent:'center',alignItems:'center',padding:16},
  pvCard:{width:W-24,backgroundColor:'#111827',borderRadius:RADIUS.xl,padding:16},
  pvTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10},
  pvTitle:{fontSize:FONT.md,fontWeight:FONT.w8,color:'#fff'},
  pvMode:{fontSize:FONT.xs,color:'rgba(255,255,255,0.5)',marginTop:2},
  pvBox:{width:'100%',height:H*0.42,borderRadius:RADIUS.lg,backgroundColor:'#0f172a',overflow:'hidden',alignItems:'center',justifyContent:'center'},
  pvImg:{width:'100%',height:'100%'},
  pvNav:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:14},
  pvArrow:{width:40,height:40,borderRadius:20,backgroundColor:'rgba(255,255,255,0.12)',alignItems:'center',justifyContent:'center'},
  pvDots:{flexDirection:'row',gap:6,alignItems:'center'},
  pvDot:{width:6,height:6,borderRadius:3,backgroundColor:'rgba(255,255,255,0.3)'},
  pvDotA:{backgroundColor:'#fff',width:18,borderRadius:3},

  dirBar:{paddingTop:TOP_INSET,paddingBottom:12,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:COLORS.border,backgroundColor:COLORS.surface},
  dirTitle:{fontSize:FONT.md,fontWeight:FONT.w8,color:COLORS.text},
  dirAppBtn:{flexDirection:'row',alignItems:'center',gap:4,borderWidth:1,borderColor:COLORS.brand,borderRadius:14,paddingVertical:4,paddingHorizontal:8},
  dirAppTxt:{fontSize:11,fontWeight:FONT.w8,color:COLORS.brand},
});
