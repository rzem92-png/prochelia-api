import test from "node:test";
import assert from "node:assert/strict";
import { createFirstManagerAtomically } from "../src/index.js";

test("first manager creation uses one conditional INSERT statement", async () => {
  let captured;
  const DB = {
    prepare(sql) {
      return { bind(...values) { captured={sql,values}; return { async run(){ return {meta:{changes:1}}; } }; } };
    }
  };
  assert.equal(await createFirstManagerAtomically({DB},{
    id:"manager-1",email:"manager@example.test",firstName:"First",lastName:"Manager",phone:null,passwordHash:"hash"
  }),true);
  assert.match(captured.sql,/INSERT INTO users[\s\S]*SELECT \?, 'gerante'/);
  assert.match(captured.sql,/WHERE NOT EXISTS \(SELECT 1 FROM users\)/);
  assert.deepEqual(captured.values,["manager-1","manager@example.test","First","Manager",null,"hash"]);
});

test("a concurrent bootstrap loser receives false when another manager already exists", async () => {
  const DB = { prepare(){ return {bind(){ return {async run(){return {meta:{changes:0}};}};}}; } };
  assert.equal(await createFirstManagerAtomically({DB},{
    id:"manager-2",email:"other@example.test",firstName:"Other",lastName:"Manager",passwordHash:"hash"
  }),false);
});

test("bootstrap helper fails closed when required inputs are missing", async () => {
  let queried=false;
  const DB={prepare(){queried=true;return {bind(){return {async run(){return {meta:{changes:1}};}};}};}};
  assert.equal(await createFirstManagerAtomically({DB},{id:"x"}),false);
  assert.equal(queried,false);
});
