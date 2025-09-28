import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './Documents.css';
import { alpha, styled } from '@mui/material/styles';
import {
  Box, Stack, Typography, Button, IconButton, TextField, Chip, Tooltip, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, LinearProgress,
  Menu, MenuItem, Paper, InputAdornment, Avatar, Skeleton, Alert, Snackbar, Fade,
  Popover
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Draw';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import CloseIcon from '@mui/icons-material/Close';
import RepeatIcon from '@mui/icons-material/Replay';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TagIcon from '@mui/icons-material/SellOutlined';
import PendingIcon from '@mui/icons-material/Pending';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';
import DataObjectIcon from '@mui/icons-material/DataObject';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { AnimatePresence, motion } from 'framer-motion';
import { listVaultFiles, uploadVaultFile, deleteVaultFile, getVaultFileUrl } from '../../../api/vaultFiles';

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '-';
  const sizes = ['B','KB','MB','GB'];
  const i = Math.min(Math.floor(Math.log(bytes)/Math.log(1024)), sizes.length -1);
  return `${(bytes/Math.pow(1024,i)).toFixed( i===0 ? 0 : 1)} ${sizes[i]}`;
};

const timeAgo = (ts) => {
  const diff = Date.now() - ts;
  const hours = Math.floor(diff / 3600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours/24); return `${days}d ago`;
};

const MotionPaper = motion(Paper);

const UploadCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: 20,
  position: 'relative',
  background: alpha(theme.palette.background.paper, 0.85),
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 18px rgba(0,0,0,0.08)'
}));

const ScrollArea = styled('div')(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  paddingRight: theme.spacing(1)
}));

// Themed card (maroon accents vs indigo)
const DocumentCard = styled(Paper)(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(1.45, 1.6, 1.1, 1.6),
  borderRadius: 20,
  background: 'linear-gradient(135deg,#ffffff 0%,#fff5f7 100%)',
  boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 0 0 1px rgba(122,14,42,0.12)',
  transition: 'box-shadow .25s, transform .25s',
  minHeight: 160,
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 10px 26px -6px rgba(122,14,42,0.22), 0 0 0 1px rgba(122,14,42,0.28)'
  }
}));

const Documents = () => {
  const [previewFile, setPreviewFile] = useState(null); // object with { key, url? }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState([]); // { tempId, name, progress, file }
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [embeddingNotes, setEmbeddingNotes] = useState('');
  const [tags, setTags] = useState(['finance','policy','2025']);
  const [newTag, setNewTag] = useState('');
  const [anchorEl, setAnchorEl] = useState(null); // sort menu anchor
  const [tab, setTab] = useState(0); // embeddings dialog tab index
  const fileInputRef = useRef();
  const [notifications, setNotifications] = useState([]); // {id, status, title, description}
  const notify = useCallback(({ status='info', title, description }) => {
    const id = Date.now() + Math.random();
    setNotifications(list => [...list, { id, status, title, description }]);
    setTimeout(() => setNotifications(list => list.filter(n => n.id !== id)), 4200);
  }, []);
  const [embeddingsOpen, setEmbeddingsOpen] = useState(false);
  const [cardMenuAnchor, setCardMenuAnchor] = useState(null); // for per-card contextual menu
  const [cardMenuFile, setCardMenuFile] = useState(null);

  // Initial fetch from backend
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        console.log('Loading vault files...');
        const mapped = await listVaultFiles();
        console.log('Vault files loaded:', mapped);
        if (!cancelled) setFiles(mapped);
      } catch (e) {
        notify({ status: 'error', title: 'Load failed', description: e.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Simulated embedding progress loop for files flagged processing
  useEffect(() => {
    if (!files.some(f => f.status === 'processing')) return;
    const timer = setInterval(() => {
      setFiles(f => f.map(file => file.status === 'processing'
        ? { ...file, status: Math.random() > 0.85 ? 'ready' : 'processing', embeddings: (file.embeddings || 0) + Math.floor(Math.random()*250) }
        : file));
    }, 2500);
    return () => clearInterval(timer);
  }, [files]);

  const filtered = useMemo(
    () => files.filter(f => f.key.toLowerCase().includes(search.toLowerCase())),
    [files, search]
  );

  const sortFiles = (mode) => {
    setFiles(f => {
      const arr = [...f];
      switch(mode){
        case 'newest': arr.sort((a,b)=> b.uploadedAt - a.uploadedAt); break;
        case 'oldest': arr.sort((a,b)=> a.uploadedAt - b.uploadedAt); break;
        case 'largest': arr.sort((a,b)=> b.size - a.size); break;
        case 'embeddings': arr.sort((a,b)=> (b.embeddings||0) - (a.embeddings||0)); break;
        default: break;
      }
      return arr;
    });
    setAnchorEl(null);
    notify({ status:'info', title:'Sorted', description: mode });
  };

  const triggerUpload = () => fileInputRef.current?.click();

  const handleFileSelect = async (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    const pdfs = list.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const rejected = list.length - pdfs.length;
    if (rejected) {
      notify({ status: 'warning', title: `${rejected} file(s) rejected`, description: 'Only PDF files are allowed.' });
    }
    for (const file of pdfs) {
      const tempId = `${file.name}-${Date.now()}`;
      const uploadObj = { tempId, name: file.name, progress: 0, file };
      setUploading(u => [...u, uploadObj]);
      try {
        // Encode + upload
        const arrayBuf = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        setUploading(u => u.map(x => x.tempId === tempId ? { ...x, progress: 20 } : x));
        // Call API (uploadVaultFile reports intermediate progress via callback)
        await uploadVaultFile(file, (p)=> setUploading(u => u.map(x => x.tempId === tempId ? { ...x, progress: Math.min(85, p) } : x)) );
        setUploading(u => u.map(x => x.tempId === tempId ? { ...x, progress: 95 } : x));
        setFiles(f => [{ key: file.name, size: file.size, uploadedAt: Date.now(), status: 'processing', embeddings: 0 }, ...f]);
        setUploading(u => u.map(x => x.tempId === tempId ? { ...x, progress: 100 } : x));
        notify({ status: 'success', title: 'Upload successful', description: file.name });
      } catch (err) {
        notify({ status: 'error', title: 'Upload failed', description: err.message });
      } finally {
        setUploading(u => u.filter(x => x.tempId !== tempId));
      }
    }
    if (e.target) e.target.value = '';
  };

  const [dragActive, setDragActive] = useState(false);
  const handleDrag = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if(['dragenter','dragover'].includes(e.type)) setDragActive(true);
    if(e.type==='dragleave') setDragActive(false);
  },[]);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const dtFiles = Array.from(e.dataTransfer.files||[]);
    if(dtFiles.length){
      const event = { target: { files: dtFiles } };
      handleFileSelect(event);
    }
  },[handleFileSelect]);

  const deleteFile = async (key) => {
    try {
      await deleteVaultFile(key);
      setFiles(f => f.filter(x => x.key !== key));
      notify({ status: 'success', title: 'Deleted', description: key });
    } catch (e) {
      notify({ status: 'error', title: 'Delete failed', description: e.message });
    }
  };

  const openEmbeddings = (file) => {
    setSelectedFile(file);
    setEmbeddingNotes('');
    setEmbeddingsOpen(true);
  };

  const saveEmbeddingsMeta = () => {
    notify({ status:'success', title:'Embeddings updated', description: selectedFile?.key });
    setEmbeddingsOpen(false);
  };

  const prettyName = (key) => (key ? key.replace(/_/g,' ') : '');

  return (
    <Stack
      direction="column"
      height="100%"
      spacing={{ xs:2.5, md:4 }}
      className="documents-container"
      position="relative"
    >
      <Box className="documents-boundary">
        <Paper elevation={0} className="documents-header-panel" onDragEnter={handleDrag}>
          <Stack spacing={1.4} className="documents-header" sx={{ pb:1 }}>
            <Box
              sx={{
                display:'flex',
                flexDirection:{ xs:'column', sm:'row' },
                alignItems:{ xs:'flex-start', sm:'flex-start' },
                justifyContent:'space-between',
                gap:{ xs:1.25, sm:2 },
                width:'100%'
              }}
            >
              {/* Title with maroon gradient */}
              <Typography
                variant="h4"
                fontWeight={700}
                sx={{
                  background: 'linear-gradient(90deg, var(--brand-maroon), #a3122d)',
                  WebkitBackgroundClip:'text',
                  backgroundClip:'text',
                  color:'transparent',
                  letterSpacing:'-0.5px'
                }}
              >
                Documents Vault
              </Typography>

              {/* Stats */}
              <Box className="documents-stats" sx={{ ml:{ xs:0, sm:'auto' } }}>
                <div className="documents-stat">
                  <span className="documents-stat-label">Total Docs</span>
                  <span className="documents-stat-value">
                    <span className="documents-stat-icon">
                      <DonutLargeIcon sx={{ fontSize:15 }} />
                    </span>
                    {files.length}
                  </span>
                </div>
                <div className="documents-stat">
                  <span className="documents-stat-label">Processing</span>
                  <span className={`documents-stat-value ${files.some(f=>f.status==='processing')? 'processing-active':''}`}>
                    <span className="documents-stat-icon"><PendingIcon sx={{ fontSize:15 }} /></span>
                    {files.filter(f=>f.status==='processing').length}
                  </span>
                </div>
                <div className="documents-stat">
                  <span className="documents-stat-label">Vectors</span>
                  <span className="documents-stat-value" style={{
                    background: 'linear-gradient(90deg,#7a0e2a,#a3122d)',
                    WebkitBackgroundClip:'text',
                    backgroundClip:'text',
                    color:'transparent'
                  }}>
                    <span className="documents-stat-icon"><ScatterPlotIcon sx={{ fontSize:15 }} /></span>
                    {files.reduce((a,c)=> a+(c.embeddings||0),0).toLocaleString()}
                  </span>
                </div>
              </Box>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ maxWidth:960 }}>
              Securely manage your knowledge base. <br/>Upload PDFs, monitor embedding status & curate metadata.
            </Typography>
          </Stack>

          <Divider sx={{ my:1.25, borderColor:'rgba(122,14,42,0.2)' }} />

          {/* Toolbar */}
          <Stack direction={{ xs:'column', sm:'row' }} spacing={1.25} alignItems={{ xs:'stretch', sm:'center' }}>
            {/* Upload (maroon gradient) */}
            <Button
              onClick={triggerUpload}
              startIcon={<AddIcon />}
              variant="contained"
              sx={{
                borderRadius:2,
                textTransform:'none',
                fontWeight:700,
                px:2.5,
                background:'linear-gradient(90deg,#a3122d,#7a0e2a)',
                '&:hover':{ background:'linear-gradient(90deg,#7a0e2a,#5e0b20)' }
              }}
            >
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileSelect}
              style={{ display:'none' }}
            />

            <TextField
              size="small"
              placeholder="Search documents"
              value={search}
              onChange={e=>setSearch(e.target.value)}
              sx={{ width:{ xs:'100%', sm:340 } }}
              InputProps={{
                startAdornment:<InputAdornment position="start"><SearchIcon fontSize='small' /></InputAdornment>
              }}
            />

            <Box flexGrow={1} />

            <IconButton
              color="primary"
              size="small"
              onClick={async ()=>{
                setLoading(true);
                try { const mapped = await listVaultFiles(); setFiles(mapped); notify({status:'success', title:'Data refreshed'}); }
                catch(e){ notify({ status:'error', title:'Refresh failed', description:e.message }); }
                finally { setLoading(false); }
              }}
              sx={{
                color:'var(--brand-maroon)',
                '&:hover':{ background:'var(--brand-maroon-100)' }
              }}
            >
              <RefreshIcon />
            </IconButton>

            <IconButton
              color="primary"
              size="small"
              onClick={(e)=> setAnchorEl(e.currentTarget)}
              sx={{
                color:'var(--brand-maroon)',
                '&:hover':{ background:'var(--brand-maroon-100)' }
              }}
            >
              <SortIcon />
            </IconButton>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={()=> setAnchorEl(null)}>
              <MenuItem onClick={()=> sortFiles('newest')}><AccessTimeIcon fontSize="small" style={{marginRight:6}} />Newest</MenuItem>
              <MenuItem onClick={()=> sortFiles('oldest')}><AccessTimeIcon fontSize="small" style={{marginRight:6, transform:'scaleX(-1)'}} />Oldest</MenuItem>
              <MenuItem onClick={()=> sortFiles('largest')}><DataObjectIcon fontSize="small" style={{marginRight:6}} />Largest</MenuItem>
              <MenuItem onClick={()=> sortFiles('embeddings')}><TrendingUpIcon fontSize="small" style={{marginRight:6}} />Embeddings</MenuItem>
            </Menu>
          </Stack>
        </Paper>
      </Box>

      {/* Upload progress toasts */}
      <AnimatePresence initial={false}>
        {uploading.map(item => (
          <MotionPaper key={item.tempId} layout initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
            <Stack direction="row" alignItems="center" spacing={3}>
              <Box flex={1}>
                <Typography variant="subtitle2" fontWeight={600}>{item.name}</Typography>
                <LinearProgress variant="determinate" value={item.progress} sx={{ mt:1, height:8, borderRadius:5 }} />
              </Box>
              <Chip label={`${item.progress}%`} color={item.progress===100 ? 'primary':'default'} size="small" />
            </Stack>
          </MotionPaper>
        ))}
      </AnimatePresence>

      <ScrollArea className="documents-content">
        <Box className="documents-boundary">
          {loading ? (
            <div className="documents-grid">
              {Array.from({length:6}).map((_,i)=>(
                <Skeleton key={i} variant="rounded" height={180} animation="wave" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="documents-grid">
              {filtered.map(file => (
                <MotionPaper
                  key={file.key}
                  component={DocumentCard}
                  layout
                  initial={{opacity:0, y:14}}
                  animate={{opacity:1, y:0}}
                  transition={{type:'spring', stiffness:300, damping:26}}
                >
                  <Stack direction="row" spacing={1.2} alignItems="flex-start" sx={{ mb:1 }}>
                    <Avatar
                      variant="rounded"
                      sx={{
                        width:44, height:52,
                        bgcolor:'var(--brand-maroon-100)',
                        color:'var(--brand-maroon)',
                        boxShadow:'inset 0 0 0 1px rgba(122,14,42,.25)'
                      }}
                    >
                      <InsertDriveFileIcon fontSize="small" />
                    </Avatar>

                    <Box flex={1} minWidth={0}>
                      <Tooltip title={file.key} placement="top" enterDelay={600}>
                        <Typography
                          variant="subtitle2"
                          fontWeight={600}
                          sx={{
                            lineHeight:1.25,
                            height:'2.5em',
                            display:'-webkit-box',
                            WebkitLineClamp:2,
                            WebkitBoxOrient:'vertical',
                            overflow:'hidden'
                          }}
                        >
                          {prettyName(file.key)}
                        </Typography>
                      </Tooltip>

                      <div className="document-meta">
                        <span className="meta-pill size">{formatBytes(file.size)}</span>
                        <span className="meta-pill uploaded">{timeAgo(file.uploadedAt)}</span>
                        <span className={`meta-pill status-${file.status}`}>{file.status}</span>
                        {file.embeddings ? (
                          <span className="meta-pill vectors">{file.embeddings.toLocaleString()}</span>
                        ) : null}
                      </div>
                    </Box>

                    <IconButton
                      size="small"
                      onClick={(e)=> { setCardMenuAnchor(e.currentTarget); setCardMenuFile(file);} }
                      sx={{ mt:-0.5, alignSelf:'flex-start', color:'var(--text-2)', '&:hover':{ bgcolor:'var(--brand-maroon-100)' } }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Stack>

                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    sx={{
                      mt:'auto', pt:1.05,
                      borderTop:'1px solid rgba(122,14,42,0.18)',
                      justifyContent: "space-between",
                    }}
                  >
                    {/* View File (outlined maroon) */}

                    <Button size="small" variant="contained" onClick={async ()=>{
                      setPreviewLoading(true);
                      try {
                        const data = await getVaultFileUrl(file.key);
                        setPreviewFile({ ...file, url: data.url, expires_in: data.expires_in });
                        notify({ status:'info', title:'File ready', description:`URL expires in ${data.expires_in}s` });
                      } catch (e) {
                        notify({ status:'error', title:'Open failed', description: e.message });
                      } finally {
                        setPreviewLoading(false);
                      }
                    }} sx={{textTransform:'none',fontSize:12,fontWeight:700,px:1.6,whiteSpace:'nowrap',background:'linear-gradient(90deg,#a3122d,#7a0e2a)',color:'#fff','&:hover':{background:'linear-gradient(90deg,#7a0e2a,#5e0b20)'}}} disabled={previewLoading}>
                      {previewLoading ? 'Loading...' : 'View\u00A0File'}
                    </Button>

                    {/* Edit Embeddings (outlined maroon) */}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={()=>openEmbeddings(file)}
                      sx={{
                        textTransform:'none',
                        fontSize:12,
                        px:1.6,
                        whiteSpace:'nowrap',
                        fontWeight:700,
                        borderColor:'rgba(122,14,42,0.45)',
                        bgcolor:'rgba(122,14,42,0.08)',
                        color:'var(--brand-maroon)',
                        '&:hover':{
                          borderColor:'rgba(122,14,42,0.65)',
                          bgcolor:'rgba(122,14,42,0.14)'
                        }
                      }}
                      startIcon={<EditIcon sx={{ fontSize:16 }} />}
                    >
                      Edit Embeddings
                    </Button>

                    {/* Delete */}
                    <Button
                      size="small"
                      variant="text"
                      color="error"
                      onClick={()=>deleteFile(file.key)}
                      sx={{ textTransform:'none', fontSize:12, fontWeight:700, ml:'auto', '&:hover':{ bgcolor:'rgba(239,68,68,0.10)' } }}
                      startIcon={<DeleteIcon sx={{ fontSize:16 }} />}
                    >
                      Delete
                    </Button>
                  </Stack>
                </MotionPaper>
              ))}
            </div>
          ) : (
            <Stack alignItems="center" justifyContent="center" py={12} spacing={2} sx={{ opacity:.85 }}>
              <AutoAwesomeIcon sx={{ fontSize:84, color:'text.disabled' }} />
              <Typography variant="h6" fontWeight={600}>Your knowledge base is quiet.</Typography>
              <Typography variant="body2" color="text.secondary">Drop PDFs above to begin embedding intelligence.</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={triggerUpload}
                sx={{
                  textTransform:'none',
                  fontWeight:700,
                  background:'linear-gradient(90deg,#a3122d,#7a0e2a)',
                  '&:hover':{ background:'linear-gradient(90deg,#7a0e2a,#5e0b20)' }
                }}
              >
                Upload your first PDF
              </Button>
            </Stack>
          )}
        </Box>
      </ScrollArea>

      {/* Embeddings dialog */}
      <Dialog
        open={embeddingsOpen}
        onClose={()=> setEmbeddingsOpen(false)}
        fullWidth maxWidth="md"
        TransitionComponent={Fade}
        TransitionProps={{ timeout:400 }}
      >
        <DialogTitle
          sx={{
            background:'linear-gradient(90deg,#7a0e2a,#a3122d)',
            color:'#fff',
            display:'flex',
            alignItems:'center',
            justifyContent:'space-between'
          }}
        >
          <Typography variant="h6" fontWeight={700} sx={{ m:0 }}>Embeddings Manager</Typography>
          <IconButton
            aria-label="close"
            onClick={()=> setEmbeddingsOpen(false)}
            size="small"
            sx={{ color:'#fff', '&:hover':{ bgcolor:'rgba(255,255,255,0.15)' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor:'rgba(122,14,42,0.18)' }}>
          {selectedFile && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>{selectedFile.key}</Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt:1, fontSize:12, color:'text.secondary' }}>
                  <Chip size="small" label={formatBytes(selectedFile.size)} />
                  <Chip size="small" label={`Status: ${selectedFile.status}`} color={selectedFile.status==='ready'?'success':'warning'} />
                  <Chip size="small" label={`Vectors: ${selectedFile.embeddings || 0}`} />
                </Stack>
              </Box>

              <Tabs
                value={tab}
                onChange={(e,v)=> setTab(v)}
                textColor="primary"
                indicatorColor="primary"
                sx={{
                  '& .MuiTabs-indicator': { backgroundColor:'var(--brand-maroon)' },
                  '& .MuiTab-root.Mui-selected': { color:'var(--brand-maroon)' }
                }}
              >
                <Tab label="Overview" />
                <Tab label="Re-Embed" />
                <Tab label="Metadata" />
              </Tabs>

              {tab===0 && (
                <Stack spacing={2}>
                  <Typography variant="body2">
                    Embeddings represent semantic vectors derived from document chunks. Use this panel to curate context quality.
                  </Typography>
                  <Paper variant="outlined" sx={{ p:2, borderRadius:3, borderColor:'rgba(122,14,42,0.22)' }}>
                    <Typography variant="caption" color="text.secondary">Recent Activity</Typography>
                    <Typography variant="body2" sx={{ mt:1 }}>
                      Initial embedding job queued <Chip size="small" label="5m" sx={{ ml:1 }} />
                    </Typography>
                    <Typography variant="caption">
                      Chunk size: 1,000 tokens • Model: text-embedding-3-large
                    </Typography>
                  </Paper>
                </Stack>
              )}

              {tab===1 && (
                <Stack spacing={2}>
                  <Typography variant="body2">Trigger a fresh embedding pass. This will re-process the PDF and replace existing vectors.</Typography>
                  <Button
                    startIcon={<RepeatIcon />}
                    variant="outlined"
                    onClick={()=> notify({status:'info', title:'Re-embed job queued'})}
                    sx={{
                      textTransform:'none',
                      borderColor:'rgba(122,14,42,0.45)',
                      color:'var(--brand-maroon)',
                      '&:hover':{ borderColor:'rgba(122,14,42,0.7)', background:'rgba(122,14,42,0.08)' }
                    }}
                  >
                    Queue Re-Embedding
                  </Button>
                </Stack>
              )}

              {tab===2 && (
                <Stack spacing={2}>
                  <Typography variant="body2">Add curator notes or tagging directives to influence retrieval ranking.</Typography>
                  <TextField multiline minRows={4} placeholder="Enter curator notes..." value={embeddingNotes} onChange={e=>setEmbeddingNotes(e.target.value)} />
                  <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    {tags.map(t => (
                      <Chip key={t} icon={<TagIcon />} label={t} variant="outlined" onDelete={()=> setTags(tags.filter(x=>x!==t))} />
                    ))}
                    <TextField
                      size="small"
                      placeholder="Add tag"
                      value={newTag}
                      onChange={e=> setNewTag(e.target.value)}
                      onKeyDown={e=> {
                        if(e.key==='Enter' && newTag.trim()){
                          if(!tags.includes(newTag.trim())) setTags([...tags, newTag.trim()]);
                          setNewTag('');
                        }
                      }}
                      sx={{ width:120 }}
                    />
                  </Stack>
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p:2 }}>
          <Button
            variant="contained"
            onClick={saveEmbeddingsMeta}
            sx={{
              textTransform:'none',
              fontWeight:700,
              background:'linear-gradient(90deg,#a3122d,#7a0e2a)',
              '&:hover':{ background:'linear-gradient(90deg,#7a0e2a,#5e0b20)' }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    {/*  PDF Preview Dialog */}
      <Dialog
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        fullWidth
        maxWidth="lg"
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 300 }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={600}>
            {previewFile?.key}
          </Typography>
          <IconButton onClick={() => setPreviewFile(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, height: '80vh', position:'relative' }}>
          {previewFile?.url ? (
            <iframe
              src={previewFile.url}
              title={previewFile.key}
              width="100%"
              height="100%"
              style={{ border: 'none' }}
            />
          ) : (
            <Stack alignItems="center" justifyContent="center" height="100%" spacing={2}>
              <LinearProgress sx={{ width: 260 }} />
              <Typography variant="body2" color="text.secondary">Fetching file...</Typography>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
      {/* Card context menu */}
      <Popover
        open={Boolean(cardMenuAnchor)}
        anchorEl={cardMenuAnchor}
        onClose={()=> { setCardMenuAnchor(null); setCardMenuFile(null); }}
        anchorOrigin={{ vertical:'bottom', horizontal:'right' }}
        transformOrigin={{ vertical:'top', horizontal:'right' }}
      >
        <Stack py={1} sx={{ minWidth:180 }}>
          <MenuItem onClick={()=> { if(cardMenuFile) openEmbeddings(cardMenuFile); setCardMenuAnchor(null); }}>
            <EditIcon fontSize="small" style={{marginRight:8}} /> Edit Embeddings
          </MenuItem>
          <MenuItem
            onClick={()=> { if(cardMenuFile) { deleteFile(cardMenuFile.key);} setCardMenuAnchor(null); }}
            sx={{ color:'error.main' }}
          >
            <DeleteIcon fontSize="small" style={{marginRight:8}} /> Delete
          </MenuItem>
        </Stack>
      </Popover>

      {/* Toasts */}
      <Snackbar open={notifications.length>0} anchorOrigin={{ vertical:'top', horizontal:'right' }}>
        <Box>
          <AnimatePresence>
            {notifications.map(n => (
              <motion.div key={n.id} initial={{opacity:0, x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:40}} style={{ marginBottom:12 }}>
                <Alert
                  severity={n.status==='warning'? 'warning': n.status==='error' ? 'error': n.status==='success' ? 'success':'info'}
                  action={
                    <IconButton size="small" onClick={()=> setNotifications(list=>list.filter(x=>x.id!==n.id))}>
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  }
                  variant="filled"
                  sx={{ borderRadius:3 }}
                >
                  <Typography variant="subtitle2" fontWeight={700}>{n.title}</Typography>
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
