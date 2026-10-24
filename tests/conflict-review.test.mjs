import test from 'node:test';
import assert from 'node:assert/strict';
import {conflictReviewReady} from '../src/lib/conflict-review.ts';

test('one conflict page is ready after viewing it',()=>{
 assert.equal(conflictReviewReady(1,10,new Set(),false),false);
 assert.equal(conflictReviewReady(1,10,new Set([0]),false),true);
 assert.equal(conflictReviewReady(0,10,new Set(),false),true);
});

test('unseen last page keeps deletion approval blocked',()=>{
 const first=new Set([0]);
 assert.equal(conflictReviewReady(11,10,first,false),false);
 assert.equal(conflictReviewReady(11,10,new Set([0,1]),false),true);
 assert.equal(conflictReviewReady(11,10,new Set([1,2]),false),false);
 assert.equal(conflictReviewReady(20,10,new Set([0]),false),false);
 assert.equal(conflictReviewReady(20,10,new Set([0,1]),false),true);
});

test('complete local JSON review report offers an alternative for large CSV files',()=>{
 assert.equal(conflictReviewReady(20000,10,new Set([0]),false),false);
 assert.equal(conflictReviewReady(20000,10,new Set([0]),true),true);
 assert.equal(conflictReviewReady(11,0,new Set([0,1]),false),false);
});
