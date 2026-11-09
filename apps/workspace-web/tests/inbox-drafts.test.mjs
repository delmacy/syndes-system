import test from "node:test";
import assert from "node:assert/strict";
import { draftKey, clearSentDraft, setDraft } from "../src/features/inbox-drafts.ts";

test("drafts stay scoped by conversation and kind without persistent storage",()=>{
 let drafts={};
 const reply=draftKey("c1","replies"), note=draftKey("c1","notes");
 drafts=setDraft(drafts,reply,"Olá");
 drafts=setDraft(drafts,note,"Nota reservada");
 drafts=setDraft(drafts,draftKey("c2","replies"),"Outra conversa");
 assert.equal(drafts[reply],"Olá");
 assert.equal(drafts[note],"Nota reservada");
 assert.equal(drafts[draftKey("c2","replies")],"Outra conversa");
 drafts=clearSentDraft(drafts,reply,"Olá");
 assert.equal(drafts[reply],undefined);
 assert.equal(drafts[note],"Nota reservada");
});
test("late successful response cannot erase a newer edit",()=>{
 const key=draftKey("c1","replies");
 let drafts=setDraft({},key,"texto inicial");
 drafts=setDraft(drafts,key,"texto editado");
 assert.equal(clearSentDraft(drafts,key,"texto inicial")[key],"texto editado");
});
