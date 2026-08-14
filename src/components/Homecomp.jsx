import React,{ useContext } from 'react';
import noteContext from '../context/notes/noteContext';
import NoteItemcomp from './NoteItemcomp';
// import { useEffect } from 'react';

const Homecomp = () => {
  /*This is being used by practice*/ 
  // const d = useContext(noteContext);

  // useEffect(()=>{
  //    d.update()
  //   // eslint-disable-next-line
  //   },[])

  // return (
  //   <div>
  //     This is {d.state.name} and he is a {d.state.role}
  //   </div>
  // )

  const context = useContext(noteContext);
  const {notes, setNotes} = (context)
  return (
      <div>
        
        {notes.map((note,index)=>{
          return <NoteItemcomp key={index} note={note}/>;
        })}
      </div>
    )


}

export default Homecomp

