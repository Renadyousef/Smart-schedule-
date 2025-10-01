import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Container, Row, Col, Button, Form, Spinner, Alert } from "react-bootstrap";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

export default function ExternalCourses() {
  const [externalRows, setExternalRows] = useState([]);
  const [form, setForm] = useState({
    courseCode: "", courseName: "", sectionNumber: "",
    capacity: "", dayOfWeek: "Sunday", startTime: "", endTime: ""
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [scheduleId, setScheduleId] = useState(null);

  const token = localStorage.getItem("token");
  const api = useMemo(()=>axios.create({
      baseURL:"http://localhost:5000/schedule",
      headers:{Authorization:`Bearer ${token}`}
  }),[token]);

  useEffect(()=>{(async()=>{
    try{ const {data}=await api.post("/init"); setScheduleId(data.scheduleId);}catch{}
  })()},[api]);

  const loadExternal=async()=>{ const {data}=await api.get(`/core-courses/slots/${scheduleId}`); setExternalRows(data);}
  useEffect(()=>{if(scheduleId) loadExternal();},[scheduleId]);

  const add=async()=>{
    if(!form.startTime||!form.endTime) return alert("Pick start & end");
    setBusy(true);
    await api.post("/core-courses/slots",{scheduleId,...form});
    await loadExternal();
    setForm({courseCode:"",courseName:"",sectionNumber:"",capacity:"",dayOfWeek:"Sunday",startTime:"",endTime:""});
    setMsg("✅ External slot added"); setTimeout(()=>setMsg(null),2000);
    setBusy(false);
  }

  if(!scheduleId) return <Container className="p-5 text-center"><Spinner animation="border"/> Initializing…</Container>

  return(
  <Container className="p-4">
    <h4>External Core Course Time Slots</h4>
    {msg && <Alert>{msg}</Alert>}
    <Form className="mb-3">
      <Row className="gy-2 gx-3">
        <Col md={2}><Form.Control placeholder="Course Code" value={form.courseCode} onChange={e=>setForm({...form,courseCode:e.target.value})}/></Col>
        <Col md={3}><Form.Control placeholder="Course Name" value={form.courseName} onChange={e=>setForm({...form,courseName:e.target.value})}/></Col>
        <Col md={2}><Form.Control placeholder="Section #" value={form.sectionNumber} onChange={e=>setForm({...form,sectionNumber:e.target.value})}/></Col>
        <Col md={2}><Form.Control placeholder="Capacity" type="number" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})}/></Col>
        <Col md={3}><Form.Select value={form.dayOfWeek} onChange={e=>setForm({...form,dayOfWeek:e.target.value})}>
          {DAYS.map(d=><option key={d}>{d}</option>)}
        </Form.Select></Col>
        <Col md={2}><Form.Control type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/></Col>
        <Col md={2}><Form.Control type="time" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/></Col>
        <Col md={12}><Button onClick={add} disabled={busy}>Add</Button></Col>
      </Row>
    </Form>
    <ul className="list-group">
      {externalRows.map((r,i)=><li key={i} className="list-group-item">
        <b>{r.course_code}</b> — {r.course_name} • Sec {r.section_number} • Cap {r.capacity} • {r.day_of_week} {r.start_time?.slice(0,5)}–{r.end_time?.slice(0,5)}
      </li>)}
    </ul>
  </Container>);
}