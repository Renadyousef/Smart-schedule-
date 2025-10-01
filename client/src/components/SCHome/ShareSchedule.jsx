import { useEffect,useMemo,useState } from "react";
import axios from "axios";
import { Container,Button,Spinner } from "react-bootstrap";

export default function ShareSchedule(){
  const [scheduleId,setScheduleId]=useState(null);
  const token=localStorage.getItem("token");
  const api=useMemo(()=>axios.create({baseURL:"http://localhost:5000/schedule",headers:{Authorization:`Bearer ${token}`}}),[token]);
  useEffect(()=>{(async()=>{const {data}=await api.post("/init");setScheduleId(data.scheduleId)})()},[api]);

  const share=async()=>{await api.post(`/share/${scheduleId}`);alert("✅ Shared with TLC");}
  if(!scheduleId) return <Container className="p-5 text-center"><Spinner animation="border"/> Loading…</Container>
  return(
    <Container className="p-5 text-center">
      <p className="lead">Ready to share your schedule with the TLC?</p>
      <Button size="lg" onClick={share}>Share Schedule</Button>
    </Container>
  );
}