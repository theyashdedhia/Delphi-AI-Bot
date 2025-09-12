import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './Documents.css';
import { alpha, styled } from '@mui/material/styles';
import { Box, Stack, Typography, Button, IconButton, TextField, Chip, Tooltip, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, LinearProgress, Menu, MenuItem, Paper, InputAdornment, Avatar, Skeleton, Alert, Snackbar, Fade, Popover } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import CloseIcon from '@mui/icons-material/Close';
import RepeatIcon from '@mui/icons-material/Replay';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import TagIcon from '@mui/icons-material/SellOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import PendingIcon from '@mui/icons-material/Pending';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';
import DataObjectIcon from '@mui/icons-material/DataObject';
import { AnimatePresence, motion } from 'framer-motion';

const mockDelay = (ms) => new Promise(r => setTimeout(r, ms));
const seedFiles = [
  { key: 'Enterprise_Strategy_Overview.pdf', size: 842311, uploadedAt: Date.now() - 3600_000 * 5, status: 'ready', embeddings: 1532 },
  { key: 'Q2_Financial_Report.pdf', size: 1320311, uploadedAt: Date.now() - 3600_000 * 24 * 2, status: 'ready', embeddings: 2048 },
  { key: 'Employee_Handbook.pdf', size: 523001, uploadedAt: Date.now() - 3600_000 * 12, status: 'processing', embeddings: 0 },
];

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '-';
  const sizes = ['B','KB','MB','GB'];
  const i = Math.min(Math.floor(Math.log(bytes)/Math.log(1024)), sizes.length -1);
  return `${(bytes/Math.pow(1024,i)).toFixed( i===0 ? 0 : 1)} ${sizes[i]}`;
};
const timeAgo = (ts) => { const diff = Date.now() - ts; const hours = Math.floor(diff / 3600_000); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours/24); return `${days}d ago`; };
const MotionPaper = motion(Paper);
const UploadCard = styled(Paper)(({ theme }) => ({ padding: theme.spacing(2), borderRadius: 20, position: 'relative', background: alpha(theme.palette.background.paper, 0.85), backdropFilter: 'blur(8px)', boxShadow: '0 4px 18px rgba(0,0,0,0.08)' }));
const ScrollArea = styled('div')(({ theme }) => ({ flex: 1, overflowY: 'auto', paddingRight: theme.spacing(1) }));
const DocumentCard = styled(Paper)(({ theme }) => ({ position: 'relative', display: 'flex', flexDirection: 'column', padding: theme.spacing(1.45, 1.6, 1.1, 1.6), borderRadius: 20, background: 'linear-gradient(135deg,#ffffff 0%,#f5f8fd 100%)', boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 0 0 1px rgba(99,102,241,0.10)', transition: 'box-shadow .25s, transform .25s', minHeight: 160, '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 10px 26px -6px rgba(79,70,229,0.25), 0 0 0 1px rgba(79,70,229,0.25)' } }));

const Documents = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [embeddingNotes, setEmbeddingNotes] = useState('');
  const [tags, setTags] = useState(['finance','policy','2025']);
  const [newTag, setNewTag] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [tab, setTab] = useState(0);
  const fileInputRef = useRef();
  const [notifications, setNotifications] = useState([]);
  const notify = useCallback(({ status='info', title, description }) => { const id = Date.now() + Math.random(); setNotifications(list => [...list, { id, status, title, description }]); setTimeout(() => setNotifications(list => list.filter(n => n.id !== id)), 4200); }, []);
  const [embeddingsOpen, setEmbeddingsOpen] = useState(false);
  const [cardMenuAnchor, setCardMenuAnchor] = useState(null);
  const [cardMenuFile, setCardMenuFile] = useState(null);

  useEffect(() => { (async () => { await mockDelay(600); setFiles(seedFiles); setLoading(false); })(); }, []);
  useEffect(() => { if (!files.length) return; const timer = setInterval(() => { setFiles(f => f.map(file => file.status === 'processing' ? { ...file, status: Math.random() > 0.7 ? 'ready' : 'processing', embeddings: file.status === 'processing' ? (file.embeddings || 0) + Math.floor(Math.random()*300) : file.embeddings } : file)); }, 2500); return () => clearInterval(timer); }, [files]);
  const filtered = useMemo(() => files.filter(f => f.key.toLowerCase().includes(search.toLowerCase())), [files, search]);

  const sortFiles = (mode) => { setFiles(f => { const arr = [...f]; switch(mode){ case 'newest': arr.sort((a,b)=> b.uploadedAt - a.uploadedAt); break; case 'oldest': arr.sort((a,b)=> a.uploadedAt - b.uploadedAt); break; case 'largest': arr.sort((a,b)=> b.size - a.size); break; case 'embeddings': arr.sort((a,b)=> (b.embeddings||0) - (a.embeddings||0)); break; default: break;} return arr; }); setAnchorEl(null); notify({ status:'info', title:'Sorted', description: mode }); };
  const triggerUpload = () => fileInputRef.current?.click();
  const handleFileSelect = async (e) => { const list = Array.from(e.target.files || []); if (!list.length) return; const pdfs = list.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')); const rejected = list.length - pdfs.length; if (rejected) { notify({ status:'warning', title:`${rejected} file(s) rejected`, description:'Only PDF files are allowed.' }); } for (const file of pdfs) { const tempId = `${file.name}-${Date.now()}`; const uploadObj = { tempId, name: file.name, progress: 0, file }; setUploading(u => [...u, uploadObj]); for (let p=0; p<=100; p+= Math.round(10 + Math.random()*25)) { await mockDelay(180 + Math.random()*220); setUploading(u => u.map(x => x.tempId === tempId ? { ...x, progress: Math.min(p,100) } : x)); } setFiles(f => [{ key: file.name, size: file.size, uploadedAt: Date.now(), status: 'processing', embeddings: 0 }, ...f]); setUploading(u => u.filter(x => x.tempId !== tempId)); notify({ status:'success', title:'Upload started', description:`${file.name} is queued for embedding.` }); } if(e.target) e.target.value = ''; };
  const [dragActive, setDragActive] = useState(false);
  const handleDrag = useCallback((e) => { e.preventDefault(); e.stopPropagation(); if(['dragenter','dragover'].includes(e.type)) setDragActive(true); if(e.type==='dragleave') setDragActive(false); },[]);
  const deleteFile = (key) => { setFiles(f => f.filter(x => x.key !== key)); notify({ status:'info', title:'Deleted', description:key }); };
  const openEmbeddings = (file) => { setSelectedFile(file); setEmbeddingNotes(''); setEmbeddingsOpen(true); };
  const saveEmbeddingsMeta = () => { notify({ status:'success', title:'Embeddings updated', description: selectedFile?.key }); setEmbeddingsOpen(false); };
  const prettyName = (key) => { if(!key) return ''; return key.replace(/_/g,' '); };

  return (
    <Stack direction="column" height="100%" spacing={{ xs:2.5, md:4 }} className="documents-container" position="relative">
      <Box className="documents-boundary">
        <Paper elevation={0} className="documents-header-panel" onDragEnter={handleDrag}>
          <Stack spacing={1.4} className="documents-header" sx={{ pb:1 }}>
            <Box sx={{ display:'flex', flexDirection:{ xs:'column', sm:'row' }, alignItems:{ xs:'flex-start', sm:'flex-start' }, justifyContent:'space-between', gap:{ xs:1.25, sm:2 }, width:'100%' }}>
              <Typography variant="h4" fontWeight={700} sx={{ background: 'linear-gradient(90deg,#4f46e5,#2563eb)', WebkitBackgroundClip:'text', color:'transparent', letterSpacing:'-0.5px' }}>Documents Vault</Typography>
              <Box className="documents-stats" sx={{ ml:{ xs:0, sm:'auto' } }}>
                <div className="documents-stat"><span className="documents-stat-label">Total Docs</span><span className="documents-stat-value"><span className="documents-stat-icon"><DonutLargeIcon sx={{ fontSize:15 }} /></span>{files.length}</span></div>
                <div className="documents-stat"><span className="documents-stat-label">Processing</span><span className={`documents-stat-value ${files.some(f=>f.status==='processing')? 'processing-active':''}`}><span className="documents-stat-icon"><PendingIcon sx={{ fontSize:15 }} /></span>{files.filter(f=>f.status==='processing').length}</span></div>
                <div className="documents-stat"><span className="documents-stat-label">Vectors</span><span className="documents-stat-value vectors"><span className="documents-stat-icon"><ScatterPlotIcon sx={{ fontSize:15 }} /></span>{files.reduce((a,c)=> a+(c.embeddings||0),0).toLocaleString()}</span></div>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth:960 }}>Securely manage your knowledge base. <br/>Upload PDFs, monitor embedding status & curate metadata.</Typography>
          </Stack>
          <Divider sx={{ my:1.25 }} />
          <Stack direction={{ xs:'column', sm:'row' }} spacing={1.25} alignItems={{ xs:'stretch', sm:'center' }}>
            <Button onClick={triggerUpload} startIcon={<AddIcon />} variant="contained" sx={{borderRadius:2, textTransform:'none', fontWeight:600, px:2.5, background:'linear-gradient(90deg,#4f46e5,#2563eb)'}}>Upload</Button>
            <input ref={fileInputRef} type="file" accept="application/pdf" multiple onChange={handleFileSelect} style={{ display:'none' }} />
            <TextField size="small" placeholder="Search documents" value={search} onChange={e=>setSearch(e.target.value)} sx={{ width:{ xs:'100%', sm:340 } }} InputProps={{ startAdornment:<InputAdornment position="start"><SearchIcon fontSize='small' /></InputAdornment> }} />
            <Box flexGrow={1} />
            <IconButton color="primary" size="small" onClick={()=>{setLoading(true); mockDelay(500).then(()=> { setLoading(false); notify({status:'success', title:'Data refreshed'});});}}><RefreshIcon /></IconButton>
            <IconButton color="primary" size="small" onClick={(e)=> setAnchorEl(e.currentTarget)}><SortIcon /></IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={()=> setAnchorEl(null)}>
              <MenuItem onClick={()=> sortFiles('newest')}><AccessTimeIcon fontSize="small" style={{marginRight:6}} />Newest</MenuItem>
              <MenuItem onClick={()=> sortFiles('oldest')}><AccessTimeIcon fontSize="small" style={{marginRight:6, transform:'scaleX(-1)'}} />Oldest</MenuItem>
              <MenuItem onClick={()=> sortFiles('largest')}><DataObjectIcon fontSize="small" style={{marginRight:6}} />Largest</MenuItem>
              <MenuItem onClick={()=> sortFiles('embeddings')}><TrendingUpIcon fontSize="small" style={{marginRight:6}} />Embeddings</MenuItem>
            </Menu>
          </Stack>
        </Paper>
      </Box>
      <AnimatePresence initial={false}>
        {uploading.map(item => (
          <MotionPaper key={item.tempId} layout initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
            <Stack direction="row" alignItems="center" spacing={3}>
              <Box flex={1}><Typography variant="subtitle2" fontWeight={600}>{item.name}</Typography><LinearProgress variant="determinate" value={item.progress} sx={{ mt:1, height:8, borderRadius:5 }} /></Box>
              <Chip label={`${item.progress}%`} color={item.progress===100 ? 'primary':'default'} size="small" />
            </Stack>
          </MotionPaper>
        ))}
      </AnimatePresence>
      <ScrollArea className="documents-content">
        <Box className="documents-boundary">
          {loading ? (
            <div className="documents-grid">{Array.from({length:6}).map((_,i)=>(<Skeleton key={i} variant="rounded" height={180} animation="wave" />))}</div>
          ) : filtered.length ? (
            <div className="documents-grid">
              {filtered.map(file => (
                <MotionPaper key={file.key} component={DocumentCard} layout initial={{opacity:0, y:14}} animate={{opacity:1, y:0}} transition={{type:'spring', stiffness:300, damping:26}}>
                  <Stack direction="row" spacing={1.2} alignItems="flex-start" sx={{ mb:1 }}>
                    <Avatar variant="rounded" sx={{ width:44, height:52, bgcolor:'#eef2ff', color:'#2563eb', boxShadow:'inset 0 0 0 1px #dbe4ff' }}><InsertDriveFileIcon fontSize="small" /></Avatar>
                    <Box flex={1} minWidth={0}>
                      <Tooltip title={file.key} placement="top" enterDelay={600}>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ lineHeight:1.25, height:'2.5em', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{file.key.replace(/_/g,' ')}</Typography>
                      </Tooltip>
                      <div className="document-meta">
                        <span className="meta-pill size">{formatBytes(file.size)}</span>
                        <span className="meta-pill uploaded">{timeAgo(file.uploadedAt)}</span>
                        <span className={`meta-pill status-${file.status}`}>{file.status}</span>
                        {file.embeddings ? <span className="meta-pill vectors">{file.embeddings.toLocaleString()}</span> : null}
                      </div>
                    </Box>
                    <IconButton size="small" onClick={(e)=> { setCardMenuAnchor(e.currentTarget); setCardMenuFile(file);} } sx={{ mt:-0.5, alignSelf:'flex-start' }}><MoreVertIcon fontSize="small" /></IconButton>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt:'auto', pt:1.05, borderTop:'1px solid rgba(148,163,184,0.25)', justifyContent: 'space-between' }}>
                    <Button size="small" variant="outlined" onClick={()=>openEmbeddings(file)} sx={{ textTransform:'none', fontSize:12, px:1.7, fontWeight:600, borderColor:'rgba(79,70,229,0.4)', bgcolor:'rgba(99,102,241,0.08)', '&:hover':{ borderColor:'rgba(79,70,229,0.6)', bgcolor:'rgba(99,102,241,0.15)' } }}>Edit Embeddings</Button>
                    <Button size="small" variant="text" color="error" onClick={()=>deleteFile(file.key)} sx={{ textTransform:'none', fontSize:12, fontWeight:600, ml:'auto', '&:hover':{ bgcolor:'rgba(239,68,68,0.10)' } }}>Delete</Button>
                  </Stack>
                </MotionPaper>
              ))}
            </div>
          ) : (
            <Stack alignItems="center" justifyContent="center" py={12} spacing={2} sx={{ opacity:.85 }}>
              <Typography variant="h6" fontWeight={600}>Your knowledge base is quiet.</Typography>
              <Typography variant="body2" color="text.secondary">Drop PDFs above to begin embedding intelligence.</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={triggerUpload} sx={{textTransform:'none'}}>Upload your first PDF</Button>
            </Stack>
          )}
        </Box>
      </ScrollArea>
      <Dialog open={embeddingsOpen} onClose={()=> setEmbeddingsOpen(false)} fullWidth maxWidth="md" TransitionComponent={Fade} TransitionProps={{ timeout:400 }}>
        <DialogTitle sx={{ background:'linear-gradient(90deg,#6366f1,#3b82f6)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Typography variant="h6" fontWeight={600} sx={{ m:0 }}>Embeddings Manager</Typography>
          <IconButton aria-label="close" onClick={()=> setEmbeddingsOpen(false)} size="small" sx={{ color:'#fff', '&:hover':{ bgcolor:'rgba(255,255,255,0.15)' } }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedFile && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>{selectedFile.key}</Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt:1, fontSize:12, color:'text.secondary' }}>
                  <Chip size="small" label={formatBytes(selectedFile.size)} />
                  <Chip size="small" label={`Status: ${selectedFile.status}`} color={selectedFile.status==='ready'?'success':'warning'} />
                  <Chip size="small" label={`Vectors: ${selectedFile.embeddings || 0}`} />
                </Stack>
              </Box>
              <Tabs value={tab} onChange={(e,v)=> setTab(v)} textColor="secondary" indicatorColor="secondary">
                <Tab label="Overview" />
                <Tab label="Re-Embed" />
                <Tab label="Metadata" />
              </Tabs>
              {tab===0 && (<Stack spacing={2}><Typography variant="body2">Embeddings represent semantic vectors derived from document chunks. Use this panel to curate context quality.</Typography><Paper variant="outlined" sx={{ p:2, borderRadius:3 }}><Typography variant="caption" color="text.secondary">Recent Activity</Typography><Typography variant="body2" sx={{ mt:1 }}>Initial embedding job queued <Chip size="small" label="5m" sx={{ ml:1 }} /></Typography><Typography variant="caption">Chunk size: 1,000 tokens • Model: text-embedding-3-large</Typography></Paper></Stack>)}
              {tab===1 && (<Stack spacing={2}><Typography variant="body2">Trigger a fresh embedding pass. This will re-process the PDF and replace existing vectors.</Typography><Button startIcon={<RepeatIcon />} variant="outlined" onClick={()=> notify({status:'info', title:'Re-embed job queued'})} sx={{ textTransform:'none' }}>Queue Re-Embedding</Button></Stack>)}
              {tab===2 && (<Stack spacing={2}><Typography variant="body2">Add curator notes or tagging directives to influence retrieval ranking.</Typography><TextField multiline minRows={4} placeholder="Enter curator notes..." value={embeddingNotes} onChange={e=>setEmbeddingNotes(e.target.value)} /> <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">{tags.map(t => (<Chip key={t} icon={<TagIcon />} label={t} variant="outlined" onDelete={()=> setTags(tags.filter(x=>x!==t))} />))}<TextField size="small" placeholder="Add tag" value={newTag} onChange={e=> setNewTag(e.target.value)} onKeyDown={e=> { if(e.key==='Enter' && newTag.trim()){ if(!tags.includes(newTag.trim())) setTags([...tags, newTag.trim()]); setNewTag(''); }} } sx={{ width:120 }} /></Stack></Stack>)}
            </Stack>
          )}
        </DialogContent>
        <DialogActions><Button variant="contained" onClick={saveEmbeddingsMeta}>Save</Button></DialogActions>
      </Dialog>
      <Popover open={Boolean(cardMenuAnchor)} anchorEl={cardMenuAnchor} onClose={()=> { setCardMenuAnchor(null); setCardMenuFile(null); }} anchorOrigin={{ vertical:'bottom', horizontal:'right' }} transformOrigin={{ vertical:'top', horizontal:'right' }}>
        <Stack py={1} sx={{ minWidth:160 }}>
          <MenuItem onClick={()=> { if(cardMenuFile) openEmbeddings(cardMenuFile); setCardMenuAnchor(null); }}>Edit Embeddings</MenuItem>
          <MenuItem onClick={()=> { if(cardMenuFile) { deleteFile(cardMenuFile.key);} setCardMenuAnchor(null); }} sx={{ color:'error.main' }}>Delete</MenuItem>
        </Stack>
      </Popover>
      <Snackbar open={notifications.length>0} anchorOrigin={{ vertical:'top', horizontal:'right' }}>
        <Box>
          <AnimatePresence>
            {notifications.map(n => (
              <motion.div key={n.id} initial={{opacity:0, x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:40}} style={{ marginBottom:12 }}>
                <Alert severity={n.status==='warning'? 'warning': n.status==='error' ? 'error': n.status==='success' ? 'success':'info'} action={<IconButton size="small" onClick={()=> setNotifications(list=>list.filter(x=>x.id!==n.id))}><CloseIcon fontSize="inherit" /></IconButton>} variant="filled" sx={{ borderRadius:3 }}>
                  <Typography variant="subtitle2" fontWeight={600}>{n.title}</Typography>
                  {n.description && <Typography variant="caption" sx={{ display:'block' }}>{n.description}</Typography>}
                </Alert>
              </motion.div>
            ))}
          </AnimatePresence>
        </Box>
      </Snackbar>
    </Stack>
  );
};

export default Documents;
