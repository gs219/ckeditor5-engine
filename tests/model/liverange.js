/**
 * @license Copyright (c) 2003-2017, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Batch from '../../src/model/batch';
import Model from '../../src/model/model';
import Element from '../../src/model/element';
import Position from '../../src/model/position';
import LiveRange from '../../src/model/liverange';
import Range from '../../src/model/range';
import Text from '../../src/model/text';
import { stringify, setData } from '../../src/dev-utils/model';

describe( 'LiveRange', () => {
	let model, doc, root, ul, p;

	beforeEach( () => {
		model = new Model();
		doc = model.document;
		root = doc.createRoot();

		const lis = [
			new Element( 'li', [], new Text( 'aaaaaaaaaa' ) ),
			new Element( 'li', [], new Text( 'bbbbbbbbbb' ) ),
			new Element( 'li', [], new Text( 'cccccccccc' ) ),
			new Element( 'li', [], new Text( 'dddddddddd' ) ),
			new Element( 'li', [], new Text( 'eeeeeeeeee' ) ),
			new Element( 'li', [], new Text( 'ffffffffff' ) ),
			new Element( 'li', [], new Text( 'gggggggggg' ) ),
			new Element( 'li', [], new Text( 'hhhhhhhhhh' ) )
		];

		ul = new Element( 'ul', [], lis );
		p = new Element( 'p', [], new Text( 'qwertyuiop' ) );

		root.insertChildren( 0, [ ul, p, new Text( 'xyzxyz' ) ] );
	} );

	it( 'should be an instance of Range', () => {
		const live = new LiveRange( new Position( root, [ 0 ] ), new Position( root, [ 1 ] ) );
		live.detach();

		expect( live ).to.be.instanceof( Range );
	} );

	it( 'should listen to the model applyOperation event', () => {
		sinon.spy( LiveRange.prototype, 'listenTo' );

		const live = new LiveRange( new Position( root, [ 0 ] ), new Position( root, [ 1 ] ) );
		live.detach();

		expect( live.listenTo.calledWith( model, 'applyOperation' ) ).to.be.true;

		LiveRange.prototype.listenTo.restore();
	} );

	it( 'should stop listening when detached', () => {
		sinon.spy( LiveRange.prototype, 'stopListening' );

		const live = new LiveRange( new Position( root, [ 0 ] ), new Position( root, [ 1 ] ) );
		live.detach();

		expect( live.stopListening.called ).to.be.true;

		LiveRange.prototype.stopListening.restore();
	} );

	it( 'createIn should return LiveRange', () => {
		const range = LiveRange.createIn( p );
		expect( range ).to.be.instanceof( LiveRange );
		range.detach();
	} );

	it( 'createFromParentsAndOffsets should return LiveRange', () => {
		const range = LiveRange.createFromParentsAndOffsets( root, 0, p, 2 );
		expect( range ).to.be.instanceof( LiveRange );
		range.detach();
	} );

	it( 'createFromPositionAndShift should return LiveRange', () => {
		const range = LiveRange.createFromPositionAndShift( new Position( root, [ 0, 1 ] ), 4 );
		expect( range ).to.be.instanceof( LiveRange );
		range.detach();
	} );

	it( 'createFromRange should return LiveRange', () => {
		const range = LiveRange.createFromRange( new Range( new Position( root, [ 0 ] ), new Position( root, [ 1 ] ) ) );
		expect( range ).to.be.instanceof( LiveRange );
		range.detach();
	} );

	it( 'should fire change:range event with proper data when its boundaries are changed', () => {
		const live = new LiveRange( new Position( root, [ 0, 1, 4 ] ), new Position( root, [ 0, 2, 2 ] ) );
		const copy = Range.createFromRange( live );

		const spy = sinon.spy();
		live.on( 'change:range', spy );

		const sourcePosition = new Position( root, [ 2 ] );
		const targetPosition = new Position( root, [ 0 ] );
		const batch = new Batch();

		model.enqueueChange( batch, writer => {
			const sourceRange = Range.createFromPositionAndShift( sourcePosition, 1 );

			writer.move( sourceRange, targetPosition );
		} );

		expect( spy.calledOnce ).to.be.true;

		// First parameter available in event should be a range that is equal to the live range before the live range changed.
		expect( spy.args[ 0 ][ 1 ].isEqual( copy ) ).to.be.true;

		// Second parameter is an object with data about model changes that caused the live range to change.
		expect( spy.args[ 0 ][ 2 ].type ).to.equal( 'move' );
		expect( spy.args[ 0 ][ 2 ].batch ).to.equal( batch );
		expect( spy.args[ 0 ][ 2 ].range.isEqual( Range.createFromPositionAndShift( targetPosition, 1 ) ) ).to.be.true;
		expect( spy.args[ 0 ][ 2 ].sourcePosition.isEqual( sourcePosition ) ).to.be.true;
	} );

	it( 'should fire change:content event with proper data when content inside the range has changed', () => {
		const live = new LiveRange( new Position( root, [ 0, 1 ] ), new Position( root, [ 0, 3 ] ) );

		const spy = sinon.spy();
		live.on( 'change:content', spy );

		const sourcePosition = new Position( root, [ 0, 2, 0 ] );
		const targetPosition = new Position( root, [ 0, 4, 0 ] );
		const batch = new Batch();

		model.enqueueChange( batch, writer => {
			const sourceRange = Range.createFromPositionAndShift( sourcePosition, 2 );

			writer.move( sourceRange, targetPosition );
		} );

		expect( spy.calledOnce ).to.be.true;

		// First parameter available in event should be a range that is equal to the live range before the live range changed.
		// We compare to the `live` range, because boundaries should not have changed.
		expect( spy.args[ 0 ][ 1 ].isEqual( live ) ).to.be.true;

		// Second parameter is an object with data about model changes that caused the live range to change.
		expect( spy.args[ 0 ][ 2 ].type ).to.equal( 'move' );
		expect( spy.args[ 0 ][ 2 ].batch ).to.equal( batch );
		expect( spy.args[ 0 ][ 2 ].range.isEqual( Range.createFromPositionAndShift( targetPosition, 2 ) ) ).to.be.true;
		expect( spy.args[ 0 ][ 2 ].sourcePosition.isEqual( sourcePosition ) ).to.be.true;
	} );

	describe( 'should get transformed and fire change:range if', () => {
		let live, spy;

		beforeEach( () => {
			live = new LiveRange( new Position( root, [ 0, 1, 4 ] ), new Position( root, [ 0, 2, 2 ] ) );

			spy = sinon.spy();
			live.on( 'change:range', spy );
		} );

		afterEach( () => {
			live.detach();
		} );

		describe( 'insertion', () => {
			it( 'is in the same parent as range start and before it', () => {
				model.change( writer => {
					writer.insertText( 'xxx', new Position( root, [ 0, 1, 0 ] ) );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 7 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 2, 2 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is in the same parent as range end and before it', () => {
				model.change( writer => {
					writer.insertText( 'xxx', new Position( root, [ 0, 2, 0 ] ) );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 2, 5 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is at a position before a node from range start path', () => {
				model.change( writer => {
					writer.insert( new Element( 'li' ), new Position( root, [ 0, 0 ] ) );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 2, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 3, 2 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is at a position before a node from range end path', () => {
				model.change( writer => {
					writer.insert( new Element( 'li' ), new Position( root, [ 0, 2 ] ) );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 3, 2 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is at the live range start position and live range is collapsed', () => {
				live.end.path = [ 0, 1, 4 ];

				model.change( writer => {
					writer.insertText( 'xxx', new Position( root, [ 0, 1, 4 ] ) );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 7 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 1, 7 ] );
				expect( spy.calledOnce ).to.be.true;
			} );
		} );

		describe( 'range move', () => {
			it( 'is to the same parent as range start and before it', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 4, 0 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 4 );
					const targetPosition = new Position( root, [ 0, 1, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 8 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 2, 2 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is to the same parent as range end and before it', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 4, 0 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 4 );
					const targetPosition = new Position( root, [ 0, 2, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 2, 6 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is to a position before a node from range start path', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 4 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 2 );
					const targetPosition = new Position( root, [ 0, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 3, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 4, 2 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is to a position before a node from range end path', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 4 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 1 );
					const targetPosition = new Position( root, [ 0, 2 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 3, 2 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is from the same parent as range start and before it', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 1, 0 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 3 );
					const targetPosition = new Position( root, [ 0, 4, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 1 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 2, 2 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is from the same parent as range end and before it - #1', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 2, 0 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 1 );
					const targetPosition = new Position( root, [ 0, 4, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 2, 1 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is from the same parent as range end and before it - #2', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 2, 0 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 2 );
					const targetPosition = new Position( root, [ 0, 4, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 4, 2 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is from a position before a node from range start path', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 0 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 1 );
					const targetPosition = new Position( root, [ 0, 4 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 0, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 1, 2 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'intersects on live range left side', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 1, 2 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 4 );
					const targetPosition = new Position( root, [ 0, 4, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 2 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 2, 2 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'intersects on live range right side', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 2, 1 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 4 );
					const targetPosition = new Position( root, [ 0, 4, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 4, 1 ] ); // Included some nodes.
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is equal to live range', () => {
				live.end.path = [ 0, 1, 7 ];

				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 1, 4 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 3 );
					const targetPosition = new Position( root, [ 0, 4, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 4, 0 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 4, 3 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'contains live range', () => {
				live.end.path = [ 0, 1, 6 ];

				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 1, 3 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 5 );
					const targetPosition = new Position( root, [ 0, 4, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 4, 1 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 4, 3 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is intersecting with live range on left and points to live range', () => {
				live.end.path = [ 0, 1, 7 ];

				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 1, 2 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 3 );
					const targetPosition = new Position( root, [ 0, 1, 8 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 2 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 1, 4 ] );
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'is intersecting with live range on right and is moved into live range', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 2, 1 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 5 );
					const targetPosition = new Position( root, [ 0, 2, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 2, 1 ] );
				expect( spy.calledOnce ).to.be.true;
			} );
		} );

		describe( 'wrap', () => {
			// NOTE: it overrides the variable defined globally in these tests.
			// These tests need to be rewritten to use the batch API anyway and then this variable can be removed.
			let live;

			beforeEach( () => {
				model.schema.registerItem( 'p', '$block' );
				model.schema.registerItem( 'w' );

				model.schema.allow( { name: 'p', inside: 'w' } );
				model.schema.allow( { name: 'w', inside: '$root' } );
			} );

			afterEach( () => {
				live.detach();
			} );

			it( 'is inside the wrapped range', () => {
				setData( model, '<p>x</p><p>[a]</p><p>x</p>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					// [<p>a</p>]
					writer.wrap( new Range( new Position( root, [ 1 ] ), new Position( root, [ 2 ] ) ), 'w' );
				} );

				expect( stringify( root, live ) ).to.equal( '<p>x</p><w><p>[a]</p></w><p>x</p>' );
			} );

			it( 'its start is intersecting with the wrapped range', () => {
				setData( model, '<p>a[b</p><p>x</p><p>c]d</p>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					// [<p>ab</p>]
					writer.wrap( new Range( new Position( root, [ 0 ] ), new Position( root, [ 1 ] ) ), 'w' );
				} );

				expect( stringify( root, live ) ).to.equal( '<w><p>a[b</p></w><p>x</p><p>c]d</p>' );
			} );

			it( 'its end is intersecting with the wrapped range', () => {
				setData( model, '<p>a[b</p><p>x</p><p>c]d</p>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					// [<p>cd</p>]
					writer.wrap( new Range( new Position( root, [ 2 ] ), new Position( root, [ 3 ] ) ), 'w' );
				} );

				expect( stringify( root, live ) ).to.equal( '<p>a[b</p><p>x</p><w><p>c]d</p></w>' );
			} );

			it( 'its start is intersecting with the wrapped range (multilpe elements)', () => {
				setData( model, '<p>a[b</p><p>x</p><p>c]d</p>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					// [<p>ab</p><p>x</p>]
					writer.wrap( new Range( new Position( root, [ 0 ] ), new Position( root, [ 2 ] ) ), 'w' );
				} );

				expect( stringify( root, live ) ).to.equal( '<w><p>a[b</p><p>x</p></w><p>c]d</p>' );
			} );

			it( 'its end is intersecting with the wrapped range (multiple elements)', () => {
				setData( model, '<p>a[b</p><p>x</p><p>c]d</p>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					// [<p>x</p><p>cd</p>]
					writer.wrap( new Range( new Position( root, [ 1 ] ), new Position( root, [ 3 ] ) ), 'w' );
				} );

				expect( stringify( root, live ) ).to.equal( '<p>a[b</p><w><p>x</p><p>c]d</p></w>' );
			} );

			it( 'contains element to wrap', () => {
				setData( model, '<p>a[b</p><p>x</p><p>c]d</p>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					// [<p>x</p>]
					writer.wrap( new Range( new Position( root, [ 1 ] ), new Position( root, [ 2 ] ) ), 'w' );
				} );

				expect( stringify( root, live ) ).to.equal( '<p>a[b</p><w><p>x</p></w><p>c]d</p>' );
			} );
		} );

		describe( 'unwrap', () => {
			// NOTE: it overrides the variable defined globally in these tests.
			// These tests need to be rewritten to use the batch API anyway and then this variable can be removed.
			let live;

			beforeEach( () => {
				model.schema.registerItem( 'p', '$block' );
				model.schema.registerItem( 'w' );

				model.schema.allow( { name: 'p', inside: 'w' } );
				model.schema.allow( { name: 'w', inside: '$root' } );
			} );

			afterEach( () => {
				live.detach();
			} );

			it( 'is inside the wrapper to remove', () => {
				setData( model, '<p>x</p><w><p>[a]</p></w><p>x</p>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					writer.unwrap( root.getChild( 1 ) );
				} );

				expect( stringify( root, live ) ).to.equal( '<p>x</p><p>[a]</p><p>x</p>' );
			} );

			it( 'its start is intersecting with the wrapper to remove', () => {
				setData( model, '<w><p>a[b</p></w><p>c]d</p>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					writer.unwrap( root.getChild( 0 ) );
				} );

				expect( stringify( root, live ) ).to.equal( '<p>a[b</p><p>c]d</p>' );
			} );

			it( 'its end is intersecting with the wrapper to remove', () => {
				setData( model, '<p>a[b</p><w><p>c]d</p></w>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					writer.unwrap( root.getChild( 1 ) );
				} );

				expect( stringify( root, live ) ).to.equal( '<p>a[b</p><p>c]d</p>' );
			} );

			it( 'its start is intersecting with the wrapper to remove (multiple elements)', () => {
				setData( model, '<w><p>a[b</p><p>x</p></w><p>c]d</p>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					writer.unwrap( root.getChild( 0 ) );
				} );

				expect( stringify( root, live ) ).to.equal( '<p>a[b</p><p>x</p><p>c]d</p>' );
			} );

			it( 'its end is intersecting with the wrapper to remove (multiple elements)', () => {
				setData( model, '<p>a[b</p><w><p>x</p><p>c]d</p></w>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					writer.unwrap( root.getChild( 1 ) );
				} );

				expect( stringify( root, live ) ).to.equal( '<p>a[b</p><p>x</p><p>c]d</p>' );
			} );

			it( 'contains wrapped element', () => {
				setData( model, '<p>a[b</p><w><p>x</p></w><p>c]d</p>' );

				live = new LiveRange( doc.selection.getFirstPosition(), doc.selection.getLastPosition() );

				model.change( writer => {
					writer.unwrap( root.getChild( 1 ) );
				} );

				expect( stringify( root, live ) ).to.equal( '<p>a[b</p><p>x</p><p>c]d</p>' );
			} );
		} );
	} );

	describe( 'should not get transformed but fire change:content', () => {
		let spy, live, clone;

		beforeEach( () => {
			live = new LiveRange( new Position( root, [ 0, 1, 4 ] ), new Position( root, [ 0, 2, 2 ] ) );
			clone = Range.createFromRange( live );

			spy = sinon.spy();
			live.on( 'change:content', spy );
		} );

		afterEach( () => {
			live.detach();
		} );

		describe( 'insertion', () => {
			it( 'inside the range', () => {
				model.change( writer => {
					writer.insertText( 'xxx', new Position( root, [ 0, 1, 7 ] ) );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.calledOnce ).to.be.true;
			} );
		} );

		describe( 'range move', () => {
			it( 'inside the range', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 4, 0 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 3 );
					const targetPosition = new Position( root, [ 0, 1, 5 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'from the range', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 1, 5 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 2 );
					const targetPosition = new Position( root, [ 0, 4, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'from the beginning of range', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 1, 4 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 2 );
					const targetPosition = new Position( root, [ 0, 4, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.calledOnce ).to.be.true;
			} );

			it( 'from the range to the range', () => {
				live.end.path = [ 0, 1, 8 ];

				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 1, 5 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 1 );
					const targetPosition = new Position( root, [ 0, 1, 7 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.start.path ).to.deep.equal( [ 0, 1, 4 ] );
				expect( live.end.path ).to.deep.equal( [ 0, 1, 8 ] );
				expect( spy.calledOnce ).to.be.true;
			} );
		} );
	} );

	describe( 'should not get transformed and not fire change event if', () => {
		let otherRoot, spy, live, clone;

		before( () => {
			otherRoot = doc.createRoot( '$root', 'otherRoot' );
		} );

		beforeEach( () => {
			live = new LiveRange( new Position( root, [ 0, 1, 4 ] ), new Position( root, [ 0, 2, 2 ] ) );
			clone = Range.createFromRange( live );

			spy = sinon.spy();
			live.on( 'change', spy );
		} );

		afterEach( () => {
			live.detach();
		} );

		describe( 'insertion', () => {
			it( 'is in the same parent as range end and after it', () => {
				model.change( writer => {
					writer.insertText( 'foo', new Position( root, [ 0, 2, 7 ] ) );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.called ).to.be.false;
			} );

			it( 'is to a position after a node from range end path', () => {
				model.change( writer => {
					writer.insert( new Element( 'li' ), new Position( root, [ 3 ] ) );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.called ).to.be.false;
			} );

			it( 'is in different root', () => {
				model.change( writer => {
					writer.insert( new Element( 'li' ), new Position( otherRoot, [ 0 ] ) );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.called ).to.be.false;
			} );
		} );

		describe( 'range move', () => {
			it( 'is to the same parent as range end and after it', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 4, 0 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 3 );
					const targetPosition = new Position( root, [ 0, 2, 4 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.called ).to.be.false;
			} );

			it( 'is to a position after a node from range end path', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 5 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 1 );
					const targetPosition = new Position( root, [ 0, 4 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.called ).to.be.false;
			} );

			it( 'is from the same parent as range end and after it', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 2, 4 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 3 );
					const targetPosition = new Position( root, [ 0, 4, 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.called ).to.be.false;
			} );

			it( 'is from a position after a node from range end path', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 4 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 1 );
					const targetPosition = new Position( root, [ 0, 5 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.called ).to.be.false;
			} );

			it( 'is to different root', () => {
				model.change( writer => {
					const sourcePosition = new Position( root, [ 0, 4 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 1 );
					const targetPosition = new Position( otherRoot, [ 0 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.called ).to.be.false;
			} );

			it( 'is from different root', () => {
				model.change( writer => {
					writer.insertText( 'foo', new Position( otherRoot, [ 0 ] ) );

					const sourcePosition = new Position( otherRoot, [ 0 ] );
					const sourceRange = Range.createFromPositionAndShift( sourcePosition, 1 );
					const targetPosition = new Position( root, [ 0, 4 ] );

					writer.move( sourceRange, targetPosition );
				} );

				expect( live.isEqual( clone ) ).to.be.true;
				expect( spy.called ).to.be.false;
			} );
		} );
	} );
} );
