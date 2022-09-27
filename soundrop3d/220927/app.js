/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/playground.js":
/*!***************************!*\
  !*** ./src/playground.js ***!
  \***************************/
/***/ ((module) => {


var createScene = function () {
    //#region Constants

    const BoundsWidth = 5
    const BoundsHeight = BoundsWidth
    const BallPoolCount = 1000
    const BallRestitution = 0.98
    const BpmDefault = 60
    const BpmMin = 1
    const BpmMax = 240
    const Gravity = 3
    const PhysicsBoundsWidth = 1.25 * BoundsWidth
    const PhysicsBoundsHeight = 1.25 * BoundsHeight
    const PhysicsTickInMs = 1000 / 120
    const ToneBaseNote = 33 // 55 hz

    const HalfPI = Math.PI / 2
    const TwoPI = 2 * Math.PI

    const HalfBoundsWidth = BoundsWidth / 2
    const HalfBoundsHeight = BoundsHeight / 2
    const HalfPhysicsBoundsWidth = PhysicsBoundsWidth / 2
    const HalfPhysicsBoundsHeight = PhysicsBoundsHeight / 2
    const BallRadius = BoundsWidth / 40
    const BallHueIncrement = 360 / BallPoolCount
    const MaxPlaneWidth = Math.sqrt(BoundsWidth * BoundsWidth + BoundsHeight * BoundsHeight)
    const PhysicsTickInSeconds = PhysicsTickInMs / 1000
    const PhysicsTickInSecondsSquared = PhysicsTickInSeconds * PhysicsTickInSeconds
    const PhysicsTickInSecondsSquaredTimesGravity = PhysicsTickInSecondsSquared * Gravity

    const toDegrees = (value) => {
        return (value / TwoPI) * 360
    }

    //#endregion

    //#region Tuning

    const tuning = new class Tuning {
        constructor() {
        }

        frequencyFromPlaneScaleX = (planeScaleX) => {
            let i = MaxPlaneWidth - planeScaleX
            i /= MaxPlaneWidth
            i *= this._.notes.length - 1
            i = Math.round(i)
            const note = this._.notes[i]
            const hz = Math.pow(2, (note - ToneBaseNote) / 12)
            return hz
        }

        _ = new class {
            constructor() {
                this.setToWholeToneScale(36, 96)
            }

            notes = []

            setToWholeToneScale = (lowNote, highNote) => {
                this.notes.length = 0
                for (let i = lowNote; i <= highNote; i+=2) {
                    this.notes.push(i)
                }
            }
        }
    }

    //#endregion

    //#region Scene setup

    const scene = new BABYLON.Scene(engine)

    const camera = new BABYLON.ArcRotateCamera(`camera`, -HalfPI, HalfPI, BoundsWidth * 1.5, BABYLON.Vector3.ZeroReadOnly)
    camera.attachControl()

    const light = new BABYLON.HemisphericLight(`light`, new BABYLON.Vector3(0, 1, 0), scene)
    light.intensity = 0.7

    //#endregion

    //#region Geometry functions

    const intersection = (a1, a2, b1, b2, out) => {
        // Return `false` if one of the line lengths is zero.
        if ((a1.x === a2.x && a1.y === a2.y) || (b1.x === b2.x && b1.y === b2.y)) {
            return false
        }

        denominator = ((b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y))

        // Return `false` if lines are parallel.
        if (denominator === 0) {
            return false
        }

        let ua = ((b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)) / denominator
        let ub = ((a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x)) / denominator

        // Return `false` if the intersection is not on the segments.
        if (ua < 0 || 1 < ua || ub < 0 || 1 < ub) {
            return false
        }

        // Set out vector's x and y coordinates.
        out.x = a1.x + ua * (a2.x - a1.x)
        out.y = a1.y + ua * (a2.y - a1.y)

        return true
    }

    //#endregion

    //#region class Border
    const border = new class Border {
        constructor() {
        }

        _ = new class {
            constructor() {
                const mesh = BABYLON.MeshBuilder.CreateLines(`border`, { points: [
                    new BABYLON.Vector3(-HalfBoundsWidth,  HalfBoundsHeight, 0),
                    new BABYLON.Vector3( HalfBoundsWidth,  HalfBoundsHeight, 0),
                    new BABYLON.Vector3( HalfBoundsWidth, -HalfBoundsHeight, 0),
                    new BABYLON.Vector3(-HalfBoundsWidth, -HalfBoundsHeight, 0),
                    new BABYLON.Vector3(-HalfBoundsWidth,  HalfBoundsHeight, 0)
                ]})
                const material = new BABYLON.StandardMaterial(`border.material`)
                mesh.material = material
                mesh.isPickable = false
            }
        }
    }

    //#endregion

    //#region class Plane

    const planeMeshPrototype = BABYLON.MeshBuilder.CreateBox(`plane mesh prototype`, { size: 1 })
    planeMeshPrototype.scaling.y = 0.25
    planeMeshPrototype.scaling.z = 0.075
    planeMeshPrototype.isPickable = false
    planeMeshPrototype.isVisible = false
    planeMeshPrototype.material = new BABYLON.StandardMaterial(`plane.material`)
    planeMeshPrototype.material.diffuseColor.set(0.1, 0.1, 0.1)
    planeMeshPrototype.material.emissiveColor.set(0.1, 0.1, 0.1)

    class Plane {
        static Array = []
        static PlaneMeshMap = new WeakMap

        constructor(startPoint) {
            this._.startPoint.copyFrom(startPoint)
        }

        get startPoint() {
            return this._.startPoint
        }

        get endPoint() {
            return this._.endPoint
        }

        set endPoint(value) {
            if (!this._.mesh) {
                this._.initializeMesh()
                Plane.Array.push(this)
                Plane.PlaneMeshMap.set(this._.mesh, this)
            }
            this._.endPoint.copyFrom(value)
            this._.resetPoints()
        }

        get angle() {
            return this._.angle
        }

        get playbackRate() {
            return this._.playbackRate
        }

        freeze = () => {
            if (!!this._.mesh) {
                this._.mesh.isPickable = true
                this._.mesh.freezeWorldMatrix()
            }
        }

        resetPoints = () => {
            this._.resetPoints()
        }

        disable = () => {
            const index = Plane.Array.indexOf(this)
            if (-1 < index) {
              Plane.Array.splice(index, 1)
            }
            Plane.PlaneMeshMap.delete(this._.mesh)
            this._.disable()
            this._ = null
        }

        onCollide = (color, collisionStrength) => {
            this._.onCollide(color, collisionStrength)
        }

        render = (deltaTime) => {
            this._.render(deltaTime)
        }

        _ = new class {
            startPoint = new BABYLON.Vector3
            endPoint = new BABYLON.Vector3
            angle = 0
            playbackRate = 1
            mesh = null
            color = new BABYLON.Color3

            initializeMesh = () => {
                const mesh = this.mesh = planeMeshPrototype.clone(`plane`)
                mesh.material = mesh.material.clone(``)
                this.color = mesh.material.diffuseColor

                mesh.isVisible = true
            }

            resetPoints = () => {
                const mesh = this.mesh
                mesh.scaling.x = BABYLON.Vector3.Distance(this.startPoint, this.endPoint)
                this.playbackRate = tuning.frequencyFromPlaneScaleX(mesh.scaling.x)

                BABYLON.Vector3.CenterToRef(this.startPoint, this.endPoint, mesh.position)

                mesh.rotationQuaternion = null
                mesh.rotateAround(mesh.position, BABYLON.Vector3.RightReadOnly, HalfPI)

                let angle = Math.atan2(this.endPoint.y - this.startPoint.y, this.endPoint.x - this.startPoint.x)
                mesh.rotateAround(mesh.position, BABYLON.Vector3.RightHandedForwardReadOnly, -angle)

                if (angle < 0) {
                    angle += TwoPI
                }
                this.angle = angle
            }

            disable = () => {
                this.mesh.isVisible = false
            }

            onCollide = (color, colorStrength) => {
                this.color.r = Math.max(this.color.r, colorStrength * color.r)
                this.color.g = Math.max(this.color.g, colorStrength * color.g)
                this.color.b = Math.max(this.color.b, colorStrength * color.b)
            }

            render = (deltaTime) => {
                if (!this.mesh) {
                    return
                }
                deltaTime *= 3
                this.color.r -= deltaTime
                this.color.g -= deltaTime
                this.color.b -= deltaTime
                this.color.r = Math.max(0.1, this.color.r)
                this.color.g = Math.max(0.1, this.color.g)
                this.color.b = Math.max(0.1, this.color.b)
            }
        }
    }

    //#endregion

    //#region class BallPhysics

    class BallPhysics {
        static StartPosition = new BABYLON.Vector3(-HalfBoundsWidth * 0.75, HalfBoundsHeight * 0.95, 0)
        static IntersectionPoint = new BABYLON.Vector3

        onCollideObservable = new BABYLON.Observable
        position = new BABYLON.Vector3(0, -1000, 0)

        previousPosition = new BABYLON.Vector3
        velocity = new BABYLON.Vector3

        drop = () => {
            this.position.copyFrom(BallPhysics.StartPosition)
            this.previousPosition.copyFrom(BallPhysics.StartPosition)
            this.velocity.set(0, 0, 0)
        }

        tick = () => {
            this.previousPosition.copyFrom(this.position)
            this.position.set(
                this.position.x + this.velocity.x,
                this.position.y + this.velocity.y,
                this.position.z + this.velocity.z
            )
            this.velocity.y -= PhysicsTickInSecondsSquaredTimesGravity

            // Skip plane intersection calculations when ball is out of bounds.
            if (this.position.x < -HalfPhysicsBoundsWidth
                    || HalfPhysicsBoundsWidth < this.position.x
                    || this.position.y < -HalfPhysicsBoundsHeight
                    || HalfPhysicsBoundsHeight < this.position.y) {
                return
            }
            let ballAngle = Math.atan2(this.velocity.y, this.velocity.x)
            if (ballAngle < 0) {
                ballAngle += TwoPI
            }

            let lastPlaneHit = null

            let loopResetCount = 0
            for (let i = 0; i < Plane.Array.length; i++) {
                const plane = Plane.Array[i]

                if (intersection(this.previousPosition, this.position, plane.startPoint, plane.endPoint, Ball.intersectionPoint)) {
                    if (lastPlaneHit === plane) {
                        continue
                    }
                    lastPlaneHit = plane

                    const speed = this.velocity.length() * BallRestitution

                    let differenceAngle = plane.angle - ballAngle
                    if (differenceAngle < 0) {
                        differenceAngle += TwoPI
                    }

                    const previousBallAngle = ballAngle
                    ballAngle = plane.angle + differenceAngle
                    if (ballAngle < 0) {
                        ballAngle += TwoPI
                    }

                    this.onCollideObservable.notifyObservers({ plane: plane, bounceAngle: previousBallAngle - ballAngle, speed: speed })

                    this.velocity.set(
                        speed * Math.cos(ballAngle),
                        speed * Math.sin(ballAngle),
                        0
                    )

                    this.previousPosition.copyFrom(Ball.intersectionPoint)
                    this.position.set(
                        Ball.intersectionPoint.x + this.velocity.x,
                        Ball.intersectionPoint.y + this.velocity.y,
                        0
                    )

                    // Test each plane for intersections again with the updated positions.
                    i = 0
                    loopResetCount += 1
                    if (10 < loopResetCount) {
                        break
                    }
                }
            }
        }
    }

    //#endregion

    //#region class Ball

    const BallMesh = BABYLON.MeshBuilder.CreateSphere(`ball`, { diameter: BallRadius, segments: 16 }, scene)
    BallMesh.isVisible = false

    class Ball {
        static StartPosition = new BABYLON.Vector3(-BoundsWidth * 0.375, BoundsHeight * 0.375, 0)
        static Hue = 0
        static intersectionPoint = new BABYLON.Vector3

        static InstanceColors = new Float32Array(4 * BallPoolCount)
        static InstanceMatrices = new Float32Array(16 * BallPoolCount)
        static InstanceMatricesDirty = true
        static InstanceColorsDirty = true

        static CreateInstances = () => {
            Ball.InstanceColors.fill(0)
            Ball.InstanceMatrices.fill(0)

            // Set matrices to identity.
            for (let i = 0; i < BallPoolCount; i++) {
                const matrixIndex = 16 * i
                Ball.InstanceMatrices[matrixIndex] = 1
                Ball.InstanceMatrices[matrixIndex + 5] = 1
                Ball.InstanceMatrices[matrixIndex + 10] = 1
                Ball.InstanceMatrices[matrixIndex + 15] = 1

                const ball = ballPool[i]
                const color = ball.color
                const colorIndex = 4 * i
                Ball.InstanceColors[colorIndex] = color.r
                Ball.InstanceColors[colorIndex + 1] = color.g
                Ball.InstanceColors[colorIndex + 2] = color.b
                Ball.InstanceColors[colorIndex + 3] = 0
            }

            BallMesh.thinInstanceSetBuffer(`matrix`, Ball.InstanceMatrices, 16, false)
            BallMesh.thinInstanceSetBuffer(`color`, Ball.InstanceColors, 4, false)
            Ball.UpdateInstances()

            BallMesh.isVisible = true
        }

        static UpdateInstances = () => {
            if (Ball.InstanceMatricesDirty) {
                Ball.InstanceMatricesDirty = false
                BallMesh.thinInstanceBufferUpdated(`matrix`)
            }
            if (Ball.InstanceColorsDirty) {
                Ball.InstanceColorsDirty = false
                BallMesh.thinInstanceBufferUpdated(`color`)
            }
        }

        constructor(index, tone) {
            this._.index = index
            this._.colorIndex = 4 * index
            this._.matrixIndex = 16 * index
            this._.tone = tone

            BABYLON.Color3.HSVtoRGBToRef(Ball.Hue, 0.75, 1, this._.color)
            Ball.Hue += BallHueIncrement

            this._.updateInstanceColor()
            this._.updateInstancePosition()
        }

        get color() {
            return this._.color
        }

        get position() {
            return this._.currentPosition
        }

        drop = () => {
            this._.drop()
        }

        render = (deltaTime) => {
            this._.render(deltaTime)
        }

        _ = new class {
            index = 0
            colorIndex = 0
            matrixIndex = 0
            isVisible = false
            tone = null
            color = new BABYLON.Color3
            ballPhysics = new BallPhysics
            lastPhysicsTickInMs = 0

            constructor() {
                this.ballPhysics.onCollideObservable.add(this.onCollide)
            }

            updateInstanceColor = () => {
                const colorIndex = this.colorIndex
                const color = this.color
                Ball.InstanceColors[colorIndex] = color.r
                Ball.InstanceColors[colorIndex + 1] = color.g
                Ball.InstanceColors[colorIndex + 2] = color.b
                Ball.InstanceColors[colorIndex + 3] = this.isVisible ? 1 : 0
                Ball.InstanceColorsDirty = true
            }

            updateInstancePosition = () => {
                const matrixIndex = this.matrixIndex
                const position = this.ballPhysics.position
                Ball.InstanceMatrices[matrixIndex + 12] = position.x
                Ball.InstanceMatrices[matrixIndex + 13] = position.y
                Ball.InstanceMatricesDirty = true
            }

            drop = () => {
                this.ballPhysics.drop()
                this.updateInstancePosition()

                if (!this.isVisible) {
                    this.isVisible = true
                    this.updateInstanceColor()
                }
            }

            onCollide = (eventData) => { // plane, bounceAngle, speed) => {
                let bounceAngle = Math.abs(eventData.bounceAngle)
                if (bounceAngle < 0.1) {
                    return
                }

                const tone = this.tone
                tone.setPlaybackRate(eventData.plane.playbackRate)
                let volume = Math.min(bounceAngle * eventData.speed * 10, 1)
                const amplitude = Math.pow(2, volume) - 1
                tone.setVolume(amplitude)
                tone.play()

                let colorStrength = volume
                colorStrength = (Math.log(colorStrength + 0.01) / Math.log(100)) + 1
                colorStrength = (Math.log(colorStrength + 0.01) / Math.log(100)) + 1
                eventData.plane.onCollide(this.color, colorStrength)
            }

            onPhysicsTick = () => {
                this.ballPhysics.tick()
                this.updateInstancePosition()
            }

            render = (deltaTimeInMs) => {
                this.lastPhysicsTickInMs += deltaTimeInMs
                while (PhysicsTickInMs < this.lastPhysicsTickInMs) {
                    this.onPhysicsTick()
                    this.lastPhysicsTickInMs -= PhysicsTickInMs
                }
            }
        }
    }

    const ballPool = new Array(BallPoolCount)

    //#endregion

    //#region Ball handling

    let ballsReady = false

    BABYLON.Engine.audioEngine.lock()
    BABYLON.Engine.audioEngine.onAudioUnlockedObservable.addOnce(() => {
        const tone = new BABYLON.Sound(`tone`, `tone.wav`, scene, () => {
            for (let i = 0; i < BallPoolCount; i++) {
                const ball = new Ball(i, tone.clone(``))
                ballPool[i] = ball
            }

            ballsReady = true
            Ball.CreateInstances()
        })
    })

    let nextBallPoolIndex = 0

    const dropBall = () => {
        if (!ballsReady) {
            return
        }

        // console.debug(`dropping ball index ${nextBallPoolIndex}`)
        const ball = ballPool[nextBallPoolIndex]
        ball.drop()
        nextBallPoolIndex = (nextBallPoolIndex + 1) % BallPoolCount
    }

    let bpm = BpmDefault
    let ballDropTimePeriodInMs = 1000 * (60 / BpmDefault)

    const setBpm = (value) => {
        bpm = Math.max(BpmMin, Math.min(value, BpmMax))
        ballDropTimePeriodInMs = 1000 * (60 / bpm)
    }

    let timeFromLastBallDropInMs = 0

    scene.registerBeforeRender(() => {
        const deltaTimeInMs = engine.getDeltaTime()
        timeFromLastBallDropInMs += deltaTimeInMs
        if (ballDropTimePeriodInMs < timeFromLastBallDropInMs) {
            timeFromLastBallDropInMs -= ballDropTimePeriodInMs
            dropBall()
        }

        if (ballsReady) {
            for (let i = 0; i < ballPool.length; i++) {
                ballPool[i].render(deltaTimeInMs)
            }
            Ball.UpdateInstances()
        }
    })

    //#endregion

    //#region Plane handling

    scene.registerBeforeRender(() => {
        const deltaTime = engine.getDeltaTime() / 1000
        for (let i = 0; i < Plane.Array.length; i++) {
            Plane.Array[i].render(deltaTime)
        }
    })

    //#endregion

    //#region class GuideLine

    const guideline = new class GuideLine {
        static PointCount = 100000

        update = () => {
            this._.update()
        }

        _ = new class {
            ballPhysics = new BallPhysics
            points = new Array(GuideLine.PointCount)
            pointCloud = new BABYLON.PointsCloudSystem(`guideline`, 2, scene, { updatable: true })

            constructor() {
                for (let i = 0; i < GuideLine.PointCount; i++) {
                    this.points[i] = new BABYLON.Vector3
                }

                this.pointCloud.updateParticle = this.updatePointCloudParticle
                this.pointCloud.addPoints(GuideLine.PointCount)
                this.pointCloud.buildMeshAsync().then(() => {
                    this.pointCloud.mesh.visibility = 0.1
                    this.update()
                })
            }

            updatePointCloudParticle = (particle) => {
                particle.position.copyFrom(this.points[particle.idx])
                return particle
            }

            update = () => {
                const ball = this.ballPhysics
                const position = ball.position

                ball.drop()
                this.points[0].copyFrom(position)

                let i = 1
                for (; i < GuideLine.PointCount; i++) {
                    ball.tick()
                    this.points[i].copyFrom(position)
                    if (position.x < -BoundsWidth || BoundsWidth < position.x || position.y < -BoundsHeight) {
                        break
                    }
                }

                // Set all leftover points to the same position as the last point instead of deleting them.
                for (; i < GuideLine.PointCount; i++) {
                    this.points[i].copyFrom(position)
                }

                this.pointCloud.setParticles(0, GuideLine.PointCount)
            }
        }
    }

    //#endregion

    //#region GUI

    const gui = new class Gui {
        constructor() {
        }

        get mode() {
            return this._.mode
        }

        _ = new class {
            constructor() {
                const manager = new BABYLON.GUI.GUI3DManager(scene)

                const bpmDownButton = new BABYLON.GUI.Button3D(`gui.bpm.downButton`)
                manager.addControl(bpmDownButton)
                bpmDownButton.scaling.set(0.2, 0.2, 0.1)
                bpmDownButton.content = new BABYLON.GUI.TextBlock(`gui.bpm.downButton.text`, `-`)
                bpmDownButton.content.fontSize = 24
                bpmDownButton.content.color = `white`
                bpmDownButton.content.scaleX = 1 / bpmDownButton.scaling.x
                bpmDownButton.content.scaleY = 1 / bpmDownButton.scaling.y
                bpmDownButton.onPointerClickObservable.add(() => {
                    setBpm(bpm - 1)
                    this.updateUiText()
                })
                this.addTopLeftControl(bpmDownButton)

                const bpmUpButton = new BABYLON.GUI.Button3D(`gui.bpm.upButton`)
                manager.addControl(bpmUpButton)
                bpmUpButton.scaling.set(0.2, 0.2, 0.1)
                bpmUpButton.content = new BABYLON.GUI.TextBlock(`gui.bpm.upButton.text`, `+`)
                bpmUpButton.content.fontSize = 24
                bpmUpButton.content.color = `white`
                bpmUpButton.content.scaleX = 1 / bpmUpButton.scaling.x
                bpmUpButton.content.scaleY = 1 / bpmUpButton.scaling.y
                bpmUpButton.onPointerClickObservable.add(() => {
                    setBpm(bpm + 1)
                    this.updateUiText()
                })
                this.addTopLeftControl(bpmUpButton)

                const bpmTextButton = new BABYLON.GUI.Button3D(`gui.bpm.text.button`)
                manager.addControl(bpmTextButton)
                bpmTextButton.scaling.set(0.5, 0.2, 0.1)
                bpmTextButton.node.isPickable = false
                bpmTextButton.mesh.material.diffuseColor.set(0.75, 0.75, 0.75)
                this.addTopLeftControl(bpmTextButton)

                const bpmText = new BABYLON.GUI.TextBlock(`gui.bpm.text`)
                bpmTextButton.content = bpmText
                bpmText.color = `white`
                bpmText.fontSize = 24
                bpmText.text = `${BpmDefault} bpm`
                bpmText.scaleX = 1 / bpmTextButton.scaling.x
                bpmText.scaleY = 1 / bpmTextButton.scaling.y
                this.bpmText = bpmText

                const bpmSlider = new BABYLON.GUI.Slider3D(`gui.bpm.slider`)
                manager.addControl(bpmSlider)
                bpmSlider.position.z = 0.065
                bpmSlider.minimum = BpmMin
                bpmSlider.maximum = BpmMax
                bpmSlider.value = BpmDefault
                bpmSlider.onValueChangedObservable.add((value) => {
                    setBpm(Math.round(value))
                    this.updateUiText()
                })
                this.addTopLeftControl(bpmSlider, 0.9)
                this.bpmSlider = bpmSlider

                const modeCameraButton = new BABYLON.GUI.Button3D(`gui.mode.cameraButton`)
                manager.addControl(modeCameraButton)
                modeCameraButton.scaling.set(0.6, 0.2, 0.1)
                modeCameraButton.content = new BABYLON.GUI.TextBlock(`gui.mode.cameraButton.text`, `Camera`)
                modeCameraButton.content.color = `white`
                modeCameraButton.content.fontSize = 24
                modeCameraButton.content.scaleX = 1 / modeCameraButton.scaling.x
                modeCameraButton.content.scaleY = 1 / modeCameraButton.scaling.y
                modeCameraButton.onPointerClickObservable.add(() => { this.switchToCameraMode() })
                this.addTopRightControl(modeCameraButton)
                this.modeCameraButton = modeCameraButton

                const modeEraseButton = new BABYLON.GUI.Button3D(`gui.mode.eraseButton`)
                manager.addControl(modeEraseButton)
                modeEraseButton.scaling.set(0.6, 0.2, 0.1)
                modeEraseButton.content = new BABYLON.GUI.TextBlock(`gui.mode.eraseButton.text`, `Erase`)
                modeEraseButton.content.color = `white`
                modeEraseButton.content.fontSize = 24
                modeEraseButton.content.scaleX = 1 / modeEraseButton.scaling.x
                modeEraseButton.content.scaleY = 1 / modeEraseButton.scaling.y
                modeEraseButton.onPointerClickObservable.add(() => { this.switchToEraseMode() })
                this.addTopRightControl(modeEraseButton)
                this.modeEraseButton = modeEraseButton

                const modeDrawButton = new BABYLON.GUI.Button3D(`gui.mode.drawButton`)
                manager.addControl(modeDrawButton)
                modeDrawButton.scaling.set(0.6, 0.2, 0.1)
                modeDrawButton.content = new BABYLON.GUI.TextBlock(`gui.mode.drawButton.text`, `Draw`)
                modeDrawButton.content.color = `white`
                modeDrawButton.content.fontSize = 24
                modeDrawButton.content.scaleX = 1 / modeDrawButton.scaling.x
                modeDrawButton.content.scaleY = 1 / modeDrawButton.scaling.y
                modeDrawButton.onPointerClickObservable.add(() => { this.switchToDrawMode() })
                this.addTopRightControl(modeDrawButton)
                this.modeDrawButton = modeDrawButton

                this.switchToDrawMode()
            }

            bpmSlider = null
            bpmText = null
            modeDrawButton = null
            modeEraseButton = null
            modeCameraButton = null

            get xLeft() { return -BoundsWidth / 2 }
            get yTop() { return BoundsHeight / 2 + 0.1 }

            margin = 0.01
            xForNextTopLeftControl = this.xLeft
            xForNextTopRightControl = this.xLeft + BoundsWidth

            mode = ``

            addTopLeftControl = (control, width) => {
                if (width === undefined) {
                    const mesh = control.mesh
                    const bounds = mesh.getBoundingInfo()
                    width = (bounds.maximum.x - bounds.minimum.x) * mesh.scaling.x
                }

                control.position.x = this.xForNextTopLeftControl + width / 2
                control.position.y = this.yTop

                this.xForNextTopLeftControl += width + this.margin
            }

            addTopRightControl = (control, width) => {
                if (width === undefined) {
                    const mesh = control.mesh
                    const bounds = mesh.getBoundingInfo()
                    width = (bounds.maximum.x - bounds.minimum.x) * mesh.scaling.x
                }

                control.position.x = this.xForNextTopRightControl - width / 2
                control.position.y = this.yTop

                this.xForNextTopRightControl -= width + this.margin
            }

            switchToDrawMode = () => {
                this.mode = `DrawMode`
                this.updateUiText()
                camera.detachControl()
            }

            switchToEraseMode = () => {
                this.mode = `EraseMode`
                this.updateUiText()
                camera.detachControl()
            }

            switchToCameraMode = () => {
                this.mode = `CameraMode`
                this.updateUiText()
                camera.attachControl()
            }

            updateUiText = () => {
                this.bpmSlider.value = bpm
                this.bpmText.text = `${bpm} bpm`

                this.modeDrawButton.mesh.material.diffuseColor.set(0.5, 0.5, 0.5)
                this.modeEraseButton.mesh.material.diffuseColor.set(0.5, 0.5, 0.5)
                this.modeCameraButton.mesh.material.diffuseColor.set(0.5, 0.5, 0.5)
                let currentModeButton = null
                if (this.mode === `DrawMode`) {
                    currentModeButton = this.modeDrawButton
                }
                if (this.mode === `EraseMode`) {
                    currentModeButton = this.modeEraseButton
                }
                if (this.mode === `CameraMode`) {
                    currentModeButton = this.modeCameraButton
                }
                currentModeButton.mesh.material.diffuseColor.set(0.9, 0.9, 0.9)
            }
        }
    }

    //#endregion

    //#region Pointer handling

    const hitPointPlaneForDrawing = BABYLON.MeshBuilder.CreatePlane(`drawing plane`, { width: 2 * BoundsWidth, height: 2 * BoundsHeight })
    hitPointPlaneForDrawing.visibility = 0
    let planeBeingAdded = null

    const startAddingPlane = (startPoint) => {
        startPoint.x = Math.max(-HalfBoundsWidth, Math.min(startPoint.x, HalfBoundsWidth))
        startPoint.y = Math.max(-HalfBoundsHeight, Math.min(startPoint.y, HalfBoundsHeight))
        startPoint.z = 0
        planeBeingAdded = new Plane(startPoint)
    }

    const finishAddingPlane = () => {
        if (planeBeingAdded) {
            planeBeingAdded.freeze()
        }
        planeBeingAdded = null
    }

    scene.onPointerObservable.add((pointerInfo) => {
        switch (pointerInfo.type) {
            case BABYLON.PointerEventTypes.POINTERDOWN:
                if (pointerInfo.pickInfo.hit) {
                    if (gui.mode === `DrawMode`) {
                        startAddingPlane(pointerInfo.pickInfo.pickedPoint)
                    }
                    else if (gui.mode === `EraseMode`) {
                        const pickedMesh = pointerInfo.pickInfo.pickedMesh
                        if (Plane.PlaneMeshMap.has(pickedMesh)) {
                            Plane.PlaneMeshMap.get(pickedMesh).disable()
                            guideline.update()
                        }
                    }
                }

                break

            case BABYLON.PointerEventTypes.POINTERMOVE:
                if (planeBeingAdded) {
                    const pickInfo = scene.pick(scene.pointerX, scene.pointerY)
                    if (pickInfo.hit) {
                        const pickedPoint = pickInfo.pickedPoint
                        pickedPoint.x = Math.max(-HalfBoundsWidth, Math.min(pickedPoint.x, HalfBoundsWidth))
                        pickedPoint.y = Math.max(-HalfBoundsHeight, Math.min(pickedPoint.y, HalfBoundsHeight))
                        pickedPoint.z = 0
                        planeBeingAdded.endPoint = pickedPoint
                        guideline.update()
                    }
                }

                break

            case BABYLON.PointerEventTypes.POINTERUP:
                finishAddingPlane()
                break
        }
    })

    //#endregion

    //#region XR

    const startXr = async () => {
        try {
            const xr = await scene.createDefaultXRExperienceAsync({})
            if (!!xr && !!xr.enterExitUI) {
                xr.enterExitUI.activeButtonChangedObservable.add(() => {
                    BABYLON.Engine.audioEngine.unlock()
                })
            }
        }
        catch(e) {
            console.debug(e)
        }
    }
    startXr()

    //#endregion

    return scene
}

function isInBabylonPlayground() {
    return document.getElementById('pg-root') !== null
}

if (!isInBabylonPlayground()) {
    module.exports = createScene
}


/***/ }),

/***/ "babylonjs":
/*!**************************!*\
  !*** external "BABYLON" ***!
  \**************************/
/***/ ((module) => {

"use strict";
module.exports = BABYLON;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
/*!********************!*\
  !*** ./src/app.js ***!
  \********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var babylonjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! babylonjs */ "babylonjs");
/* harmony import */ var babylonjs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(babylonjs__WEBPACK_IMPORTED_MODULE_0__);


const createScene = __webpack_require__(/*! ./playground.js */ "./src/playground.js")
// const createScene = require('./reflections.js')

__webpack_require__.g.canvas = document.getElementsByTagName('canvas')[0]
__webpack_require__.g.engine = new babylonjs__WEBPACK_IMPORTED_MODULE_0__.Engine(canvas, true, { audioEngine: true, audioEngineOptions: {
    audioContext: new AudioContext
}})

const scene = createScene()

engine.runRenderLoop(() => {
    scene.render();
})

onresize = () => {
    engine.resize()
}

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQSxzQ0FBc0MsZUFBZTtBQUNyRDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHlFQUF5RTtBQUN6RTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQSx1RkFBdUYsU0FBUztBQUNoRztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBLDRCQUE0Qix3QkFBd0I7QUFDcEQ7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLCtEQUErRCx3RUFBd0U7O0FBRXZJO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBOztBQUVBLGdFQUFnRSxvQ0FBb0M7QUFDcEc7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0EsNEJBQTRCLG1CQUFtQjtBQUMvQztBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEseUNBQXlDO0FBQ3pDO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSw0QkFBNEIsbUJBQW1CO0FBQy9DO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsU0FBUztBQUNULEtBQUs7O0FBRUw7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsZ0RBQWdELGtCQUFrQjtBQUNsRTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsNEJBQTRCLHFCQUFxQjtBQUNqRDtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7O0FBRUw7O0FBRUE7O0FBRUE7QUFDQTtBQUNBLHdCQUF3Qix3QkFBd0I7QUFDaEQ7QUFDQTtBQUNBLEtBQUs7O0FBRUw7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsZ0ZBQWdGLGlCQUFpQjs7QUFFakc7QUFDQSxnQ0FBZ0MsMEJBQTBCO0FBQzFEO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBLHVCQUF1QiwwQkFBMEI7QUFDakQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsdUJBQXVCLDBCQUEwQjtBQUNqRDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQ0FBa0MsWUFBWTtBQUM5QztBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNFQUFzRSwyQkFBMkI7QUFDakc7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUVBQXFFLDBCQUEwQjtBQUMvRjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvRUFBb0UseUJBQXlCO0FBQzdGO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLDBCQUEwQjtBQUMxQix5QkFBeUI7O0FBRXpCO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHVDQUF1QyxLQUFLOztBQUU1QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBOztBQUVBLHVGQUF1RixrREFBa0Q7QUFDekk7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLOztBQUVMOztBQUVBOztBQUVBO0FBQ0E7QUFDQSxvRUFBb0U7QUFDcEU7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7O0FDNTZCQTs7Ozs7O1VDQUE7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTs7VUFFQTtVQUNBOztVQUVBO1VBQ0E7VUFDQTs7Ozs7V0N0QkE7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBLGlDQUFpQyxXQUFXO1dBQzVDO1dBQ0E7Ozs7O1dDUEE7V0FDQTtXQUNBO1dBQ0E7V0FDQSx5Q0FBeUMsd0NBQXdDO1dBQ2pGO1dBQ0E7V0FDQTs7Ozs7V0NQQTtXQUNBO1dBQ0E7V0FDQTtXQUNBLEdBQUc7V0FDSDtXQUNBO1dBQ0EsQ0FBQzs7Ozs7V0NQRDs7Ozs7V0NBQTtXQUNBO1dBQ0E7V0FDQSx1REFBdUQsaUJBQWlCO1dBQ3hFO1dBQ0EsZ0RBQWdELGFBQWE7V0FDN0Q7Ozs7Ozs7Ozs7Ozs7O0FDTm9DOztBQUVwQyxvQkFBb0IsbUJBQU8sQ0FBQyw0Q0FBaUI7QUFDN0M7O0FBRUEscUJBQU07QUFDTixxQkFBTSxjQUFjLDZDQUFjLGlCQUFpQjtBQUNuRDtBQUNBLEVBQUU7O0FBRUY7O0FBRUE7QUFDQTtBQUNBLENBQUM7O0FBRUQ7QUFDQTtBQUNBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vLy4vc3JjL3BsYXlncm91bmQuanMiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIHZhciBcIkJBQllMT05cIiIsIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vL3dlYnBhY2svcnVudGltZS9jb21wYXQgZ2V0IGRlZmF1bHQgZXhwb3J0Iiwid2VicGFjazovLy93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vL3dlYnBhY2svcnVudGltZS9nbG9iYWwiLCJ3ZWJwYWNrOi8vL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vLy4vc3JjL2FwcC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcbnZhciBjcmVhdGVTY2VuZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyNyZWdpb24gQ29uc3RhbnRzXG5cbiAgICBjb25zdCBCb3VuZHNXaWR0aCA9IDVcbiAgICBjb25zdCBCb3VuZHNIZWlnaHQgPSBCb3VuZHNXaWR0aFxuICAgIGNvbnN0IEJhbGxQb29sQ291bnQgPSAxMDAwXG4gICAgY29uc3QgQmFsbFJlc3RpdHV0aW9uID0gMC45OFxuICAgIGNvbnN0IEJwbURlZmF1bHQgPSA2MFxuICAgIGNvbnN0IEJwbU1pbiA9IDFcbiAgICBjb25zdCBCcG1NYXggPSAyNDBcbiAgICBjb25zdCBHcmF2aXR5ID0gM1xuICAgIGNvbnN0IFBoeXNpY3NCb3VuZHNXaWR0aCA9IDEuMjUgKiBCb3VuZHNXaWR0aFxuICAgIGNvbnN0IFBoeXNpY3NCb3VuZHNIZWlnaHQgPSAxLjI1ICogQm91bmRzSGVpZ2h0XG4gICAgY29uc3QgUGh5c2ljc1RpY2tJbk1zID0gMTAwMCAvIDEyMFxuICAgIGNvbnN0IFRvbmVCYXNlTm90ZSA9IDMzIC8vIDU1IGh6XG5cbiAgICBjb25zdCBIYWxmUEkgPSBNYXRoLlBJIC8gMlxuICAgIGNvbnN0IFR3b1BJID0gMiAqIE1hdGguUElcblxuICAgIGNvbnN0IEhhbGZCb3VuZHNXaWR0aCA9IEJvdW5kc1dpZHRoIC8gMlxuICAgIGNvbnN0IEhhbGZCb3VuZHNIZWlnaHQgPSBCb3VuZHNIZWlnaHQgLyAyXG4gICAgY29uc3QgSGFsZlBoeXNpY3NCb3VuZHNXaWR0aCA9IFBoeXNpY3NCb3VuZHNXaWR0aCAvIDJcbiAgICBjb25zdCBIYWxmUGh5c2ljc0JvdW5kc0hlaWdodCA9IFBoeXNpY3NCb3VuZHNIZWlnaHQgLyAyXG4gICAgY29uc3QgQmFsbFJhZGl1cyA9IEJvdW5kc1dpZHRoIC8gNDBcbiAgICBjb25zdCBCYWxsSHVlSW5jcmVtZW50ID0gMzYwIC8gQmFsbFBvb2xDb3VudFxuICAgIGNvbnN0IE1heFBsYW5lV2lkdGggPSBNYXRoLnNxcnQoQm91bmRzV2lkdGggKiBCb3VuZHNXaWR0aCArIEJvdW5kc0hlaWdodCAqIEJvdW5kc0hlaWdodClcbiAgICBjb25zdCBQaHlzaWNzVGlja0luU2Vjb25kcyA9IFBoeXNpY3NUaWNrSW5NcyAvIDEwMDBcbiAgICBjb25zdCBQaHlzaWNzVGlja0luU2Vjb25kc1NxdWFyZWQgPSBQaHlzaWNzVGlja0luU2Vjb25kcyAqIFBoeXNpY3NUaWNrSW5TZWNvbmRzXG4gICAgY29uc3QgUGh5c2ljc1RpY2tJblNlY29uZHNTcXVhcmVkVGltZXNHcmF2aXR5ID0gUGh5c2ljc1RpY2tJblNlY29uZHNTcXVhcmVkICogR3Jhdml0eVxuXG4gICAgY29uc3QgdG9EZWdyZWVzID0gKHZhbHVlKSA9PiB7XG4gICAgICAgIHJldHVybiAodmFsdWUgLyBUd29QSSkgKiAzNjBcbiAgICB9XG5cbiAgICAvLyNlbmRyZWdpb25cblxuICAgIC8vI3JlZ2lvbiBUdW5pbmdcblxuICAgIGNvbnN0IHR1bmluZyA9IG5ldyBjbGFzcyBUdW5pbmcge1xuICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgfVxuXG4gICAgICAgIGZyZXF1ZW5jeUZyb21QbGFuZVNjYWxlWCA9IChwbGFuZVNjYWxlWCkgPT4ge1xuICAgICAgICAgICAgbGV0IGkgPSBNYXhQbGFuZVdpZHRoIC0gcGxhbmVTY2FsZVhcbiAgICAgICAgICAgIGkgLz0gTWF4UGxhbmVXaWR0aFxuICAgICAgICAgICAgaSAqPSB0aGlzLl8ubm90ZXMubGVuZ3RoIC0gMVxuICAgICAgICAgICAgaSA9IE1hdGgucm91bmQoaSlcbiAgICAgICAgICAgIGNvbnN0IG5vdGUgPSB0aGlzLl8ubm90ZXNbaV1cbiAgICAgICAgICAgIGNvbnN0IGh6ID0gTWF0aC5wb3coMiwgKG5vdGUgLSBUb25lQmFzZU5vdGUpIC8gMTIpXG4gICAgICAgICAgICByZXR1cm4gaHpcbiAgICAgICAgfVxuXG4gICAgICAgIF8gPSBuZXcgY2xhc3Mge1xuICAgICAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRUb1dob2xlVG9uZVNjYWxlKDM2LCA5NilcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm90ZXMgPSBbXVxuXG4gICAgICAgICAgICBzZXRUb1dob2xlVG9uZVNjYWxlID0gKGxvd05vdGUsIGhpZ2hOb3RlKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3Rlcy5sZW5ndGggPSAwXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IGxvd05vdGU7IGkgPD0gaGlnaE5vdGU7IGkrPTIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ub3Rlcy5wdXNoKGkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8jZW5kcmVnaW9uXG5cbiAgICAvLyNyZWdpb24gU2NlbmUgc2V0dXBcblxuICAgIGNvbnN0IHNjZW5lID0gbmV3IEJBQllMT04uU2NlbmUoZW5naW5lKVxuXG4gICAgY29uc3QgY2FtZXJhID0gbmV3IEJBQllMT04uQXJjUm90YXRlQ2FtZXJhKGBjYW1lcmFgLCAtSGFsZlBJLCBIYWxmUEksIEJvdW5kc1dpZHRoICogMS41LCBCQUJZTE9OLlZlY3RvcjMuWmVyb1JlYWRPbmx5KVxuICAgIGNhbWVyYS5hdHRhY2hDb250cm9sKClcblxuICAgIGNvbnN0IGxpZ2h0ID0gbmV3IEJBQllMT04uSGVtaXNwaGVyaWNMaWdodChgbGlnaHRgLCBuZXcgQkFCWUxPTi5WZWN0b3IzKDAsIDEsIDApLCBzY2VuZSlcbiAgICBsaWdodC5pbnRlbnNpdHkgPSAwLjdcblxuICAgIC8vI2VuZHJlZ2lvblxuXG4gICAgLy8jcmVnaW9uIEdlb21ldHJ5IGZ1bmN0aW9uc1xuXG4gICAgY29uc3QgaW50ZXJzZWN0aW9uID0gKGExLCBhMiwgYjEsIGIyLCBvdXQpID0+IHtcbiAgICAgICAgLy8gUmV0dXJuIGBmYWxzZWAgaWYgb25lIG9mIHRoZSBsaW5lIGxlbmd0aHMgaXMgemVyby5cbiAgICAgICAgaWYgKChhMS54ID09PSBhMi54ICYmIGExLnkgPT09IGEyLnkpIHx8IChiMS54ID09PSBiMi54ICYmIGIxLnkgPT09IGIyLnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgfVxuXG4gICAgICAgIGRlbm9taW5hdG9yID0gKChiMi55IC0gYjEueSkgKiAoYTIueCAtIGExLngpIC0gKGIyLnggLSBiMS54KSAqIChhMi55IC0gYTEueSkpXG5cbiAgICAgICAgLy8gUmV0dXJuIGBmYWxzZWAgaWYgbGluZXMgYXJlIHBhcmFsbGVsLlxuICAgICAgICBpZiAoZGVub21pbmF0b3IgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHVhID0gKChiMi54IC0gYjEueCkgKiAoYTEueSAtIGIxLnkpIC0gKGIyLnkgLSBiMS55KSAqIChhMS54IC0gYjEueCkpIC8gZGVub21pbmF0b3JcbiAgICAgICAgbGV0IHViID0gKChhMi54IC0gYTEueCkgKiAoYTEueSAtIGIxLnkpIC0gKGEyLnkgLSBhMS55KSAqIChhMS54IC0gYjEueCkpIC8gZGVub21pbmF0b3JcblxuICAgICAgICAvLyBSZXR1cm4gYGZhbHNlYCBpZiB0aGUgaW50ZXJzZWN0aW9uIGlzIG5vdCBvbiB0aGUgc2VnbWVudHMuXG4gICAgICAgIGlmICh1YSA8IDAgfHwgMSA8IHVhIHx8IHViIDwgMCB8fCAxIDwgdWIpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0IG91dCB2ZWN0b3IncyB4IGFuZCB5IGNvb3JkaW5hdGVzLlxuICAgICAgICBvdXQueCA9IGExLnggKyB1YSAqIChhMi54IC0gYTEueClcbiAgICAgICAgb3V0LnkgPSBhMS55ICsgdWEgKiAoYTIueSAtIGExLnkpXG5cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvLyNlbmRyZWdpb25cblxuICAgIC8vI3JlZ2lvbiBjbGFzcyBCb3JkZXJcbiAgICBjb25zdCBib3JkZXIgPSBuZXcgY2xhc3MgQm9yZGVyIHtcbiAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIH1cblxuICAgICAgICBfID0gbmV3IGNsYXNzIHtcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBCQUJZTE9OLk1lc2hCdWlsZGVyLkNyZWF0ZUxpbmVzKGBib3JkZXJgLCB7IHBvaW50czogW1xuICAgICAgICAgICAgICAgICAgICBuZXcgQkFCWUxPTi5WZWN0b3IzKC1IYWxmQm91bmRzV2lkdGgsICBIYWxmQm91bmRzSGVpZ2h0LCAwKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IEJBQllMT04uVmVjdG9yMyggSGFsZkJvdW5kc1dpZHRoLCAgSGFsZkJvdW5kc0hlaWdodCwgMCksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBCQUJZTE9OLlZlY3RvcjMoIEhhbGZCb3VuZHNXaWR0aCwgLUhhbGZCb3VuZHNIZWlnaHQsIDApLFxuICAgICAgICAgICAgICAgICAgICBuZXcgQkFCWUxPTi5WZWN0b3IzKC1IYWxmQm91bmRzV2lkdGgsIC1IYWxmQm91bmRzSGVpZ2h0LCAwKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IEJBQllMT04uVmVjdG9yMygtSGFsZkJvdW5kc1dpZHRoLCAgSGFsZkJvdW5kc0hlaWdodCwgMClcbiAgICAgICAgICAgICAgICBdfSlcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBCQUJZTE9OLlN0YW5kYXJkTWF0ZXJpYWwoYGJvcmRlci5tYXRlcmlhbGApXG4gICAgICAgICAgICAgICAgbWVzaC5tYXRlcmlhbCA9IG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgbWVzaC5pc1BpY2thYmxlID0gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vI2VuZHJlZ2lvblxuXG4gICAgLy8jcmVnaW9uIGNsYXNzIFBsYW5lXG5cbiAgICBjb25zdCBwbGFuZU1lc2hQcm90b3R5cGUgPSBCQUJZTE9OLk1lc2hCdWlsZGVyLkNyZWF0ZUJveChgcGxhbmUgbWVzaCBwcm90b3R5cGVgLCB7IHNpemU6IDEgfSlcbiAgICBwbGFuZU1lc2hQcm90b3R5cGUuc2NhbGluZy55ID0gMC4yNVxuICAgIHBsYW5lTWVzaFByb3RvdHlwZS5zY2FsaW5nLnogPSAwLjA3NVxuICAgIHBsYW5lTWVzaFByb3RvdHlwZS5pc1BpY2thYmxlID0gZmFsc2VcbiAgICBwbGFuZU1lc2hQcm90b3R5cGUuaXNWaXNpYmxlID0gZmFsc2VcbiAgICBwbGFuZU1lc2hQcm90b3R5cGUubWF0ZXJpYWwgPSBuZXcgQkFCWUxPTi5TdGFuZGFyZE1hdGVyaWFsKGBwbGFuZS5tYXRlcmlhbGApXG4gICAgcGxhbmVNZXNoUHJvdG90eXBlLm1hdGVyaWFsLmRpZmZ1c2VDb2xvci5zZXQoMC4xLCAwLjEsIDAuMSlcbiAgICBwbGFuZU1lc2hQcm90b3R5cGUubWF0ZXJpYWwuZW1pc3NpdmVDb2xvci5zZXQoMC4xLCAwLjEsIDAuMSlcblxuICAgIGNsYXNzIFBsYW5lIHtcbiAgICAgICAgc3RhdGljIEFycmF5ID0gW11cbiAgICAgICAgc3RhdGljIFBsYW5lTWVzaE1hcCA9IG5ldyBXZWFrTWFwXG5cbiAgICAgICAgY29uc3RydWN0b3Ioc3RhcnRQb2ludCkge1xuICAgICAgICAgICAgdGhpcy5fLnN0YXJ0UG9pbnQuY29weUZyb20oc3RhcnRQb2ludClcbiAgICAgICAgfVxuXG4gICAgICAgIGdldCBzdGFydFBvaW50KCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuXy5zdGFydFBvaW50XG4gICAgICAgIH1cblxuICAgICAgICBnZXQgZW5kUG9pbnQoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fLmVuZFBvaW50XG4gICAgICAgIH1cblxuICAgICAgICBzZXQgZW5kUG9pbnQodmFsdWUpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fLm1lc2gpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl8uaW5pdGlhbGl6ZU1lc2goKVxuICAgICAgICAgICAgICAgIFBsYW5lLkFycmF5LnB1c2godGhpcylcbiAgICAgICAgICAgICAgICBQbGFuZS5QbGFuZU1lc2hNYXAuc2V0KHRoaXMuXy5tZXNoLCB0aGlzKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fLmVuZFBvaW50LmNvcHlGcm9tKHZhbHVlKVxuICAgICAgICAgICAgdGhpcy5fLnJlc2V0UG9pbnRzKClcbiAgICAgICAgfVxuXG4gICAgICAgIGdldCBhbmdsZSgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl8uYW5nbGVcbiAgICAgICAgfVxuXG4gICAgICAgIGdldCBwbGF5YmFja1JhdGUoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fLnBsYXliYWNrUmF0ZVxuICAgICAgICB9XG5cbiAgICAgICAgZnJlZXplID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCEhdGhpcy5fLm1lc2gpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl8ubWVzaC5pc1BpY2thYmxlID0gdHJ1ZVxuICAgICAgICAgICAgICAgIHRoaXMuXy5tZXNoLmZyZWV6ZVdvcmxkTWF0cml4KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJlc2V0UG9pbnRzID0gKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fLnJlc2V0UG9pbnRzKClcbiAgICAgICAgfVxuXG4gICAgICAgIGRpc2FibGUgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IFBsYW5lLkFycmF5LmluZGV4T2YodGhpcylcbiAgICAgICAgICAgIGlmICgtMSA8IGluZGV4KSB7XG4gICAgICAgICAgICAgIFBsYW5lLkFycmF5LnNwbGljZShpbmRleCwgMSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFBsYW5lLlBsYW5lTWVzaE1hcC5kZWxldGUodGhpcy5fLm1lc2gpXG4gICAgICAgICAgICB0aGlzLl8uZGlzYWJsZSgpXG4gICAgICAgICAgICB0aGlzLl8gPSBudWxsXG4gICAgICAgIH1cblxuICAgICAgICBvbkNvbGxpZGUgPSAoY29sb3IsIGNvbGxpc2lvblN0cmVuZ3RoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl8ub25Db2xsaWRlKGNvbG9yLCBjb2xsaXNpb25TdHJlbmd0aClcbiAgICAgICAgfVxuXG4gICAgICAgIHJlbmRlciA9IChkZWx0YVRpbWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMuXy5yZW5kZXIoZGVsdGFUaW1lKVxuICAgICAgICB9XG5cbiAgICAgICAgXyA9IG5ldyBjbGFzcyB7XG4gICAgICAgICAgICBzdGFydFBvaW50ID0gbmV3IEJBQllMT04uVmVjdG9yM1xuICAgICAgICAgICAgZW5kUG9pbnQgPSBuZXcgQkFCWUxPTi5WZWN0b3IzXG4gICAgICAgICAgICBhbmdsZSA9IDBcbiAgICAgICAgICAgIHBsYXliYWNrUmF0ZSA9IDFcbiAgICAgICAgICAgIG1lc2ggPSBudWxsXG4gICAgICAgICAgICBjb2xvciA9IG5ldyBCQUJZTE9OLkNvbG9yM1xuXG4gICAgICAgICAgICBpbml0aWFsaXplTWVzaCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gdGhpcy5tZXNoID0gcGxhbmVNZXNoUHJvdG90eXBlLmNsb25lKGBwbGFuZWApXG4gICAgICAgICAgICAgICAgbWVzaC5tYXRlcmlhbCA9IG1lc2gubWF0ZXJpYWwuY2xvbmUoYGApXG4gICAgICAgICAgICAgICAgdGhpcy5jb2xvciA9IG1lc2gubWF0ZXJpYWwuZGlmZnVzZUNvbG9yXG5cbiAgICAgICAgICAgICAgICBtZXNoLmlzVmlzaWJsZSA9IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVzZXRQb2ludHMgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IHRoaXMubWVzaFxuICAgICAgICAgICAgICAgIG1lc2guc2NhbGluZy54ID0gQkFCWUxPTi5WZWN0b3IzLkRpc3RhbmNlKHRoaXMuc3RhcnRQb2ludCwgdGhpcy5lbmRQb2ludClcbiAgICAgICAgICAgICAgICB0aGlzLnBsYXliYWNrUmF0ZSA9IHR1bmluZy5mcmVxdWVuY3lGcm9tUGxhbmVTY2FsZVgobWVzaC5zY2FsaW5nLngpXG5cbiAgICAgICAgICAgICAgICBCQUJZTE9OLlZlY3RvcjMuQ2VudGVyVG9SZWYodGhpcy5zdGFydFBvaW50LCB0aGlzLmVuZFBvaW50LCBtZXNoLnBvc2l0aW9uKVxuXG4gICAgICAgICAgICAgICAgbWVzaC5yb3RhdGlvblF1YXRlcm5pb24gPSBudWxsXG4gICAgICAgICAgICAgICAgbWVzaC5yb3RhdGVBcm91bmQobWVzaC5wb3NpdGlvbiwgQkFCWUxPTi5WZWN0b3IzLlJpZ2h0UmVhZE9ubHksIEhhbGZQSSlcblxuICAgICAgICAgICAgICAgIGxldCBhbmdsZSA9IE1hdGguYXRhbjIodGhpcy5lbmRQb2ludC55IC0gdGhpcy5zdGFydFBvaW50LnksIHRoaXMuZW5kUG9pbnQueCAtIHRoaXMuc3RhcnRQb2ludC54KVxuICAgICAgICAgICAgICAgIG1lc2gucm90YXRlQXJvdW5kKG1lc2gucG9zaXRpb24sIEJBQllMT04uVmVjdG9yMy5SaWdodEhhbmRlZEZvcndhcmRSZWFkT25seSwgLWFuZ2xlKVxuXG4gICAgICAgICAgICAgICAgaWYgKGFuZ2xlIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICBhbmdsZSArPSBUd29QSVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmFuZ2xlID0gYW5nbGVcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGlzYWJsZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLm1lc2guaXNWaXNpYmxlID0gZmFsc2VcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb25Db2xsaWRlID0gKGNvbG9yLCBjb2xvclN0cmVuZ3RoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5jb2xvci5yID0gTWF0aC5tYXgodGhpcy5jb2xvci5yLCBjb2xvclN0cmVuZ3RoICogY29sb3IucilcbiAgICAgICAgICAgICAgICB0aGlzLmNvbG9yLmcgPSBNYXRoLm1heCh0aGlzLmNvbG9yLmcsIGNvbG9yU3RyZW5ndGggKiBjb2xvci5nKVxuICAgICAgICAgICAgICAgIHRoaXMuY29sb3IuYiA9IE1hdGgubWF4KHRoaXMuY29sb3IuYiwgY29sb3JTdHJlbmd0aCAqIGNvbG9yLmIpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJlbmRlciA9IChkZWx0YVRpbWUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMubWVzaCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVsdGFUaW1lICo9IDNcbiAgICAgICAgICAgICAgICB0aGlzLmNvbG9yLnIgLT0gZGVsdGFUaW1lXG4gICAgICAgICAgICAgICAgdGhpcy5jb2xvci5nIC09IGRlbHRhVGltZVxuICAgICAgICAgICAgICAgIHRoaXMuY29sb3IuYiAtPSBkZWx0YVRpbWVcbiAgICAgICAgICAgICAgICB0aGlzLmNvbG9yLnIgPSBNYXRoLm1heCgwLjEsIHRoaXMuY29sb3IucilcbiAgICAgICAgICAgICAgICB0aGlzLmNvbG9yLmcgPSBNYXRoLm1heCgwLjEsIHRoaXMuY29sb3IuZylcbiAgICAgICAgICAgICAgICB0aGlzLmNvbG9yLmIgPSBNYXRoLm1heCgwLjEsIHRoaXMuY29sb3IuYilcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vI2VuZHJlZ2lvblxuXG4gICAgLy8jcmVnaW9uIGNsYXNzIEJhbGxQaHlzaWNzXG5cbiAgICBjbGFzcyBCYWxsUGh5c2ljcyB7XG4gICAgICAgIHN0YXRpYyBTdGFydFBvc2l0aW9uID0gbmV3IEJBQllMT04uVmVjdG9yMygtSGFsZkJvdW5kc1dpZHRoICogMC43NSwgSGFsZkJvdW5kc0hlaWdodCAqIDAuOTUsIDApXG4gICAgICAgIHN0YXRpYyBJbnRlcnNlY3Rpb25Qb2ludCA9IG5ldyBCQUJZTE9OLlZlY3RvcjNcblxuICAgICAgICBvbkNvbGxpZGVPYnNlcnZhYmxlID0gbmV3IEJBQllMT04uT2JzZXJ2YWJsZVxuICAgICAgICBwb3NpdGlvbiA9IG5ldyBCQUJZTE9OLlZlY3RvcjMoMCwgLTEwMDAsIDApXG5cbiAgICAgICAgcHJldmlvdXNQb3NpdGlvbiA9IG5ldyBCQUJZTE9OLlZlY3RvcjNcbiAgICAgICAgdmVsb2NpdHkgPSBuZXcgQkFCWUxPTi5WZWN0b3IzXG5cbiAgICAgICAgZHJvcCA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucG9zaXRpb24uY29weUZyb20oQmFsbFBoeXNpY3MuU3RhcnRQb3NpdGlvbilcbiAgICAgICAgICAgIHRoaXMucHJldmlvdXNQb3NpdGlvbi5jb3B5RnJvbShCYWxsUGh5c2ljcy5TdGFydFBvc2l0aW9uKVxuICAgICAgICAgICAgdGhpcy52ZWxvY2l0eS5zZXQoMCwgMCwgMClcbiAgICAgICAgfVxuXG4gICAgICAgIHRpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzUG9zaXRpb24uY29weUZyb20odGhpcy5wb3NpdGlvbilcbiAgICAgICAgICAgIHRoaXMucG9zaXRpb24uc2V0KFxuICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24ueCArIHRoaXMudmVsb2NpdHkueCxcbiAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uLnkgKyB0aGlzLnZlbG9jaXR5LnksXG4gICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbi56ICsgdGhpcy52ZWxvY2l0eS56XG4gICAgICAgICAgICApXG4gICAgICAgICAgICB0aGlzLnZlbG9jaXR5LnkgLT0gUGh5c2ljc1RpY2tJblNlY29uZHNTcXVhcmVkVGltZXNHcmF2aXR5XG5cbiAgICAgICAgICAgIC8vIFNraXAgcGxhbmUgaW50ZXJzZWN0aW9uIGNhbGN1bGF0aW9ucyB3aGVuIGJhbGwgaXMgb3V0IG9mIGJvdW5kcy5cbiAgICAgICAgICAgIGlmICh0aGlzLnBvc2l0aW9uLnggPCAtSGFsZlBoeXNpY3NCb3VuZHNXaWR0aFxuICAgICAgICAgICAgICAgICAgICB8fCBIYWxmUGh5c2ljc0JvdW5kc1dpZHRoIDwgdGhpcy5wb3NpdGlvbi54XG4gICAgICAgICAgICAgICAgICAgIHx8IHRoaXMucG9zaXRpb24ueSA8IC1IYWxmUGh5c2ljc0JvdW5kc0hlaWdodFxuICAgICAgICAgICAgICAgICAgICB8fCBIYWxmUGh5c2ljc0JvdW5kc0hlaWdodCA8IHRoaXMucG9zaXRpb24ueSkge1xuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IGJhbGxBbmdsZSA9IE1hdGguYXRhbjIodGhpcy52ZWxvY2l0eS55LCB0aGlzLnZlbG9jaXR5LngpXG4gICAgICAgICAgICBpZiAoYmFsbEFuZ2xlIDwgMCkge1xuICAgICAgICAgICAgICAgIGJhbGxBbmdsZSArPSBUd29QSVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgbGFzdFBsYW5lSGl0ID0gbnVsbFxuXG4gICAgICAgICAgICBsZXQgbG9vcFJlc2V0Q291bnQgPSAwXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IFBsYW5lLkFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGxhbmUgPSBQbGFuZS5BcnJheVtpXVxuXG4gICAgICAgICAgICAgICAgaWYgKGludGVyc2VjdGlvbih0aGlzLnByZXZpb3VzUG9zaXRpb24sIHRoaXMucG9zaXRpb24sIHBsYW5lLnN0YXJ0UG9pbnQsIHBsYW5lLmVuZFBvaW50LCBCYWxsLmludGVyc2VjdGlvblBvaW50KSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobGFzdFBsYW5lSGl0ID09PSBwbGFuZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsYXN0UGxhbmVIaXQgPSBwbGFuZVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNwZWVkID0gdGhpcy52ZWxvY2l0eS5sZW5ndGgoKSAqIEJhbGxSZXN0aXR1dGlvblxuXG4gICAgICAgICAgICAgICAgICAgIGxldCBkaWZmZXJlbmNlQW5nbGUgPSBwbGFuZS5hbmdsZSAtIGJhbGxBbmdsZVxuICAgICAgICAgICAgICAgICAgICBpZiAoZGlmZmVyZW5jZUFuZ2xlIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGlmZmVyZW5jZUFuZ2xlICs9IFR3b1BJXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmV2aW91c0JhbGxBbmdsZSA9IGJhbGxBbmdsZVxuICAgICAgICAgICAgICAgICAgICBiYWxsQW5nbGUgPSBwbGFuZS5hbmdsZSArIGRpZmZlcmVuY2VBbmdsZVxuICAgICAgICAgICAgICAgICAgICBpZiAoYmFsbEFuZ2xlIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYmFsbEFuZ2xlICs9IFR3b1BJXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uQ29sbGlkZU9ic2VydmFibGUubm90aWZ5T2JzZXJ2ZXJzKHsgcGxhbmU6IHBsYW5lLCBib3VuY2VBbmdsZTogcHJldmlvdXNCYWxsQW5nbGUgLSBiYWxsQW5nbGUsIHNwZWVkOiBzcGVlZCB9KVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudmVsb2NpdHkuc2V0KFxuICAgICAgICAgICAgICAgICAgICAgICAgc3BlZWQgKiBNYXRoLmNvcyhiYWxsQW5nbGUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3BlZWQgKiBNYXRoLnNpbihiYWxsQW5nbGUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgMFxuICAgICAgICAgICAgICAgICAgICApXG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcmV2aW91c1Bvc2l0aW9uLmNvcHlGcm9tKEJhbGwuaW50ZXJzZWN0aW9uUG9pbnQpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24uc2V0KFxuICAgICAgICAgICAgICAgICAgICAgICAgQmFsbC5pbnRlcnNlY3Rpb25Qb2ludC54ICsgdGhpcy52ZWxvY2l0eS54LFxuICAgICAgICAgICAgICAgICAgICAgICAgQmFsbC5pbnRlcnNlY3Rpb25Qb2ludC55ICsgdGhpcy52ZWxvY2l0eS55LFxuICAgICAgICAgICAgICAgICAgICAgICAgMFxuICAgICAgICAgICAgICAgICAgICApXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVGVzdCBlYWNoIHBsYW5lIGZvciBpbnRlcnNlY3Rpb25zIGFnYWluIHdpdGggdGhlIHVwZGF0ZWQgcG9zaXRpb25zLlxuICAgICAgICAgICAgICAgICAgICBpID0gMFxuICAgICAgICAgICAgICAgICAgICBsb29wUmVzZXRDb3VudCArPSAxXG4gICAgICAgICAgICAgICAgICAgIGlmICgxMCA8IGxvb3BSZXNldENvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8jZW5kcmVnaW9uXG5cbiAgICAvLyNyZWdpb24gY2xhc3MgQmFsbFxuXG4gICAgY29uc3QgQmFsbE1lc2ggPSBCQUJZTE9OLk1lc2hCdWlsZGVyLkNyZWF0ZVNwaGVyZShgYmFsbGAsIHsgZGlhbWV0ZXI6IEJhbGxSYWRpdXMsIHNlZ21lbnRzOiAxNiB9LCBzY2VuZSlcbiAgICBCYWxsTWVzaC5pc1Zpc2libGUgPSBmYWxzZVxuXG4gICAgY2xhc3MgQmFsbCB7XG4gICAgICAgIHN0YXRpYyBTdGFydFBvc2l0aW9uID0gbmV3IEJBQllMT04uVmVjdG9yMygtQm91bmRzV2lkdGggKiAwLjM3NSwgQm91bmRzSGVpZ2h0ICogMC4zNzUsIDApXG4gICAgICAgIHN0YXRpYyBIdWUgPSAwXG4gICAgICAgIHN0YXRpYyBpbnRlcnNlY3Rpb25Qb2ludCA9IG5ldyBCQUJZTE9OLlZlY3RvcjNcblxuICAgICAgICBzdGF0aWMgSW5zdGFuY2VDb2xvcnMgPSBuZXcgRmxvYXQzMkFycmF5KDQgKiBCYWxsUG9vbENvdW50KVxuICAgICAgICBzdGF0aWMgSW5zdGFuY2VNYXRyaWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoMTYgKiBCYWxsUG9vbENvdW50KVxuICAgICAgICBzdGF0aWMgSW5zdGFuY2VNYXRyaWNlc0RpcnR5ID0gdHJ1ZVxuICAgICAgICBzdGF0aWMgSW5zdGFuY2VDb2xvcnNEaXJ0eSA9IHRydWVcblxuICAgICAgICBzdGF0aWMgQ3JlYXRlSW5zdGFuY2VzID0gKCkgPT4ge1xuICAgICAgICAgICAgQmFsbC5JbnN0YW5jZUNvbG9ycy5maWxsKDApXG4gICAgICAgICAgICBCYWxsLkluc3RhbmNlTWF0cmljZXMuZmlsbCgwKVxuXG4gICAgICAgICAgICAvLyBTZXQgbWF0cmljZXMgdG8gaWRlbnRpdHkuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IEJhbGxQb29sQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdHJpeEluZGV4ID0gMTYgKiBpXG4gICAgICAgICAgICAgICAgQmFsbC5JbnN0YW5jZU1hdHJpY2VzW21hdHJpeEluZGV4XSA9IDFcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlTWF0cmljZXNbbWF0cml4SW5kZXggKyA1XSA9IDFcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlTWF0cmljZXNbbWF0cml4SW5kZXggKyAxMF0gPSAxXG4gICAgICAgICAgICAgICAgQmFsbC5JbnN0YW5jZU1hdHJpY2VzW21hdHJpeEluZGV4ICsgMTVdID0gMVxuXG4gICAgICAgICAgICAgICAgY29uc3QgYmFsbCA9IGJhbGxQb29sW2ldXG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3IgPSBiYWxsLmNvbG9yXG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3JJbmRleCA9IDQgKiBpXG4gICAgICAgICAgICAgICAgQmFsbC5JbnN0YW5jZUNvbG9yc1tjb2xvckluZGV4XSA9IGNvbG9yLnJcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlQ29sb3JzW2NvbG9ySW5kZXggKyAxXSA9IGNvbG9yLmdcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlQ29sb3JzW2NvbG9ySW5kZXggKyAyXSA9IGNvbG9yLmJcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlQ29sb3JzW2NvbG9ySW5kZXggKyAzXSA9IDBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgQmFsbE1lc2gudGhpbkluc3RhbmNlU2V0QnVmZmVyKGBtYXRyaXhgLCBCYWxsLkluc3RhbmNlTWF0cmljZXMsIDE2LCBmYWxzZSlcbiAgICAgICAgICAgIEJhbGxNZXNoLnRoaW5JbnN0YW5jZVNldEJ1ZmZlcihgY29sb3JgLCBCYWxsLkluc3RhbmNlQ29sb3JzLCA0LCBmYWxzZSlcbiAgICAgICAgICAgIEJhbGwuVXBkYXRlSW5zdGFuY2VzKClcblxuICAgICAgICAgICAgQmFsbE1lc2guaXNWaXNpYmxlID0gdHJ1ZVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIFVwZGF0ZUluc3RhbmNlcyA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmIChCYWxsLkluc3RhbmNlTWF0cmljZXNEaXJ0eSkge1xuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VNYXRyaWNlc0RpcnR5ID0gZmFsc2VcbiAgICAgICAgICAgICAgICBCYWxsTWVzaC50aGluSW5zdGFuY2VCdWZmZXJVcGRhdGVkKGBtYXRyaXhgKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKEJhbGwuSW5zdGFuY2VDb2xvcnNEaXJ0eSkge1xuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VDb2xvcnNEaXJ0eSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgQmFsbE1lc2gudGhpbkluc3RhbmNlQnVmZmVyVXBkYXRlZChgY29sb3JgKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3RydWN0b3IoaW5kZXgsIHRvbmUpIHtcbiAgICAgICAgICAgIHRoaXMuXy5pbmRleCA9IGluZGV4XG4gICAgICAgICAgICB0aGlzLl8uY29sb3JJbmRleCA9IDQgKiBpbmRleFxuICAgICAgICAgICAgdGhpcy5fLm1hdHJpeEluZGV4ID0gMTYgKiBpbmRleFxuICAgICAgICAgICAgdGhpcy5fLnRvbmUgPSB0b25lXG5cbiAgICAgICAgICAgIEJBQllMT04uQ29sb3IzLkhTVnRvUkdCVG9SZWYoQmFsbC5IdWUsIDAuNzUsIDEsIHRoaXMuXy5jb2xvcilcbiAgICAgICAgICAgIEJhbGwuSHVlICs9IEJhbGxIdWVJbmNyZW1lbnRcblxuICAgICAgICAgICAgdGhpcy5fLnVwZGF0ZUluc3RhbmNlQ29sb3IoKVxuICAgICAgICAgICAgdGhpcy5fLnVwZGF0ZUluc3RhbmNlUG9zaXRpb24oKVxuICAgICAgICB9XG5cbiAgICAgICAgZ2V0IGNvbG9yKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuXy5jb2xvclxuICAgICAgICB9XG5cbiAgICAgICAgZ2V0IHBvc2l0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuXy5jdXJyZW50UG9zaXRpb25cbiAgICAgICAgfVxuXG4gICAgICAgIGRyb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl8uZHJvcCgpXG4gICAgICAgIH1cblxuICAgICAgICByZW5kZXIgPSAoZGVsdGFUaW1lKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl8ucmVuZGVyKGRlbHRhVGltZSlcbiAgICAgICAgfVxuXG4gICAgICAgIF8gPSBuZXcgY2xhc3Mge1xuICAgICAgICAgICAgaW5kZXggPSAwXG4gICAgICAgICAgICBjb2xvckluZGV4ID0gMFxuICAgICAgICAgICAgbWF0cml4SW5kZXggPSAwXG4gICAgICAgICAgICBpc1Zpc2libGUgPSBmYWxzZVxuICAgICAgICAgICAgdG9uZSA9IG51bGxcbiAgICAgICAgICAgIGNvbG9yID0gbmV3IEJBQllMT04uQ29sb3IzXG4gICAgICAgICAgICBiYWxsUGh5c2ljcyA9IG5ldyBCYWxsUGh5c2ljc1xuICAgICAgICAgICAgbGFzdFBoeXNpY3NUaWNrSW5NcyA9IDBcblxuICAgICAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5iYWxsUGh5c2ljcy5vbkNvbGxpZGVPYnNlcnZhYmxlLmFkZCh0aGlzLm9uQ29sbGlkZSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdXBkYXRlSW5zdGFuY2VDb2xvciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xvckluZGV4ID0gdGhpcy5jb2xvckluZGV4XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3IgPSB0aGlzLmNvbG9yXG4gICAgICAgICAgICAgICAgQmFsbC5JbnN0YW5jZUNvbG9yc1tjb2xvckluZGV4XSA9IGNvbG9yLnJcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlQ29sb3JzW2NvbG9ySW5kZXggKyAxXSA9IGNvbG9yLmdcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlQ29sb3JzW2NvbG9ySW5kZXggKyAyXSA9IGNvbG9yLmJcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlQ29sb3JzW2NvbG9ySW5kZXggKyAzXSA9IHRoaXMuaXNWaXNpYmxlID8gMSA6IDBcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlQ29sb3JzRGlydHkgPSB0cnVlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHVwZGF0ZUluc3RhbmNlUG9zaXRpb24gPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0cml4SW5kZXggPSB0aGlzLm1hdHJpeEluZGV4XG4gICAgICAgICAgICAgICAgY29uc3QgcG9zaXRpb24gPSB0aGlzLmJhbGxQaHlzaWNzLnBvc2l0aW9uXG4gICAgICAgICAgICAgICAgQmFsbC5JbnN0YW5jZU1hdHJpY2VzW21hdHJpeEluZGV4ICsgMTJdID0gcG9zaXRpb24ueFxuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VNYXRyaWNlc1ttYXRyaXhJbmRleCArIDEzXSA9IHBvc2l0aW9uLnlcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlTWF0cmljZXNEaXJ0eSA9IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZHJvcCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmJhbGxQaHlzaWNzLmRyb3AoKVxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlSW5zdGFuY2VQb3NpdGlvbigpXG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNWaXNpYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaXNWaXNpYmxlID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RhbmNlQ29sb3IoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb25Db2xsaWRlID0gKGV2ZW50RGF0YSkgPT4geyAvLyBwbGFuZSwgYm91bmNlQW5nbGUsIHNwZWVkKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IGJvdW5jZUFuZ2xlID0gTWF0aC5hYnMoZXZlbnREYXRhLmJvdW5jZUFuZ2xlKVxuICAgICAgICAgICAgICAgIGlmIChib3VuY2VBbmdsZSA8IDAuMSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b25lID0gdGhpcy50b25lXG4gICAgICAgICAgICAgICAgdG9uZS5zZXRQbGF5YmFja1JhdGUoZXZlbnREYXRhLnBsYW5lLnBsYXliYWNrUmF0ZSlcbiAgICAgICAgICAgICAgICBsZXQgdm9sdW1lID0gTWF0aC5taW4oYm91bmNlQW5nbGUgKiBldmVudERhdGEuc3BlZWQgKiAxMCwgMSlcbiAgICAgICAgICAgICAgICBjb25zdCBhbXBsaXR1ZGUgPSBNYXRoLnBvdygyLCB2b2x1bWUpIC0gMVxuICAgICAgICAgICAgICAgIHRvbmUuc2V0Vm9sdW1lKGFtcGxpdHVkZSlcbiAgICAgICAgICAgICAgICB0b25lLnBsYXkoKVxuXG4gICAgICAgICAgICAgICAgbGV0IGNvbG9yU3RyZW5ndGggPSB2b2x1bWVcbiAgICAgICAgICAgICAgICBjb2xvclN0cmVuZ3RoID0gKE1hdGgubG9nKGNvbG9yU3RyZW5ndGggKyAwLjAxKSAvIE1hdGgubG9nKDEwMCkpICsgMVxuICAgICAgICAgICAgICAgIGNvbG9yU3RyZW5ndGggPSAoTWF0aC5sb2coY29sb3JTdHJlbmd0aCArIDAuMDEpIC8gTWF0aC5sb2coMTAwKSkgKyAxXG4gICAgICAgICAgICAgICAgZXZlbnREYXRhLnBsYW5lLm9uQ29sbGlkZSh0aGlzLmNvbG9yLCBjb2xvclN0cmVuZ3RoKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBvblBoeXNpY3NUaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuYmFsbFBoeXNpY3MudGljaygpXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVJbnN0YW5jZVBvc2l0aW9uKClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVuZGVyID0gKGRlbHRhVGltZUluTXMpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmxhc3RQaHlzaWNzVGlja0luTXMgKz0gZGVsdGFUaW1lSW5Nc1xuICAgICAgICAgICAgICAgIHdoaWxlIChQaHlzaWNzVGlja0luTXMgPCB0aGlzLmxhc3RQaHlzaWNzVGlja0luTXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vblBoeXNpY3NUaWNrKClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sYXN0UGh5c2ljc1RpY2tJbk1zIC09IFBoeXNpY3NUaWNrSW5Nc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGJhbGxQb29sID0gbmV3IEFycmF5KEJhbGxQb29sQ291bnQpXG5cbiAgICAvLyNlbmRyZWdpb25cblxuICAgIC8vI3JlZ2lvbiBCYWxsIGhhbmRsaW5nXG5cbiAgICBsZXQgYmFsbHNSZWFkeSA9IGZhbHNlXG5cbiAgICBCQUJZTE9OLkVuZ2luZS5hdWRpb0VuZ2luZS5sb2NrKClcbiAgICBCQUJZTE9OLkVuZ2luZS5hdWRpb0VuZ2luZS5vbkF1ZGlvVW5sb2NrZWRPYnNlcnZhYmxlLmFkZE9uY2UoKCkgPT4ge1xuICAgICAgICBjb25zdCB0b25lID0gbmV3IEJBQllMT04uU291bmQoYHRvbmVgLCBgdG9uZS53YXZgLCBzY2VuZSwgKCkgPT4ge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBCYWxsUG9vbENvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWxsID0gbmV3IEJhbGwoaSwgdG9uZS5jbG9uZShgYCkpXG4gICAgICAgICAgICAgICAgYmFsbFBvb2xbaV0gPSBiYWxsXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJhbGxzUmVhZHkgPSB0cnVlXG4gICAgICAgICAgICBCYWxsLkNyZWF0ZUluc3RhbmNlcygpXG4gICAgICAgIH0pXG4gICAgfSlcblxuICAgIGxldCBuZXh0QmFsbFBvb2xJbmRleCA9IDBcblxuICAgIGNvbnN0IGRyb3BCYWxsID0gKCkgPT4ge1xuICAgICAgICBpZiAoIWJhbGxzUmVhZHkpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgLy8gY29uc29sZS5kZWJ1ZyhgZHJvcHBpbmcgYmFsbCBpbmRleCAke25leHRCYWxsUG9vbEluZGV4fWApXG4gICAgICAgIGNvbnN0IGJhbGwgPSBiYWxsUG9vbFtuZXh0QmFsbFBvb2xJbmRleF1cbiAgICAgICAgYmFsbC5kcm9wKClcbiAgICAgICAgbmV4dEJhbGxQb29sSW5kZXggPSAobmV4dEJhbGxQb29sSW5kZXggKyAxKSAlIEJhbGxQb29sQ291bnRcbiAgICB9XG5cbiAgICBsZXQgYnBtID0gQnBtRGVmYXVsdFxuICAgIGxldCBiYWxsRHJvcFRpbWVQZXJpb2RJbk1zID0gMTAwMCAqICg2MCAvIEJwbURlZmF1bHQpXG5cbiAgICBjb25zdCBzZXRCcG0gPSAodmFsdWUpID0+IHtcbiAgICAgICAgYnBtID0gTWF0aC5tYXgoQnBtTWluLCBNYXRoLm1pbih2YWx1ZSwgQnBtTWF4KSlcbiAgICAgICAgYmFsbERyb3BUaW1lUGVyaW9kSW5NcyA9IDEwMDAgKiAoNjAgLyBicG0pXG4gICAgfVxuXG4gICAgbGV0IHRpbWVGcm9tTGFzdEJhbGxEcm9wSW5NcyA9IDBcblxuICAgIHNjZW5lLnJlZ2lzdGVyQmVmb3JlUmVuZGVyKCgpID0+IHtcbiAgICAgICAgY29uc3QgZGVsdGFUaW1lSW5NcyA9IGVuZ2luZS5nZXREZWx0YVRpbWUoKVxuICAgICAgICB0aW1lRnJvbUxhc3RCYWxsRHJvcEluTXMgKz0gZGVsdGFUaW1lSW5Nc1xuICAgICAgICBpZiAoYmFsbERyb3BUaW1lUGVyaW9kSW5NcyA8IHRpbWVGcm9tTGFzdEJhbGxEcm9wSW5Ncykge1xuICAgICAgICAgICAgdGltZUZyb21MYXN0QmFsbERyb3BJbk1zIC09IGJhbGxEcm9wVGltZVBlcmlvZEluTXNcbiAgICAgICAgICAgIGRyb3BCYWxsKClcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChiYWxsc1JlYWR5KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJhbGxQb29sLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYmFsbFBvb2xbaV0ucmVuZGVyKGRlbHRhVGltZUluTXMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBCYWxsLlVwZGF0ZUluc3RhbmNlcygpXG4gICAgICAgIH1cbiAgICB9KVxuXG4gICAgLy8jZW5kcmVnaW9uXG5cbiAgICAvLyNyZWdpb24gUGxhbmUgaGFuZGxpbmdcblxuICAgIHNjZW5lLnJlZ2lzdGVyQmVmb3JlUmVuZGVyKCgpID0+IHtcbiAgICAgICAgY29uc3QgZGVsdGFUaW1lID0gZW5naW5lLmdldERlbHRhVGltZSgpIC8gMTAwMFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IFBsYW5lLkFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBQbGFuZS5BcnJheVtpXS5yZW5kZXIoZGVsdGFUaW1lKVxuICAgICAgICB9XG4gICAgfSlcblxuICAgIC8vI2VuZHJlZ2lvblxuXG4gICAgLy8jcmVnaW9uIGNsYXNzIEd1aWRlTGluZVxuXG4gICAgY29uc3QgZ3VpZGVsaW5lID0gbmV3IGNsYXNzIEd1aWRlTGluZSB7XG4gICAgICAgIHN0YXRpYyBQb2ludENvdW50ID0gMTAwMDAwXG5cbiAgICAgICAgdXBkYXRlID0gKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fLnVwZGF0ZSgpXG4gICAgICAgIH1cblxuICAgICAgICBfID0gbmV3IGNsYXNzIHtcbiAgICAgICAgICAgIGJhbGxQaHlzaWNzID0gbmV3IEJhbGxQaHlzaWNzXG4gICAgICAgICAgICBwb2ludHMgPSBuZXcgQXJyYXkoR3VpZGVMaW5lLlBvaW50Q291bnQpXG4gICAgICAgICAgICBwb2ludENsb3VkID0gbmV3IEJBQllMT04uUG9pbnRzQ2xvdWRTeXN0ZW0oYGd1aWRlbGluZWAsIDIsIHNjZW5lLCB7IHVwZGF0YWJsZTogdHJ1ZSB9KVxuXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IEd1aWRlTGluZS5Qb2ludENvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wb2ludHNbaV0gPSBuZXcgQkFCWUxPTi5WZWN0b3IzXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5wb2ludENsb3VkLnVwZGF0ZVBhcnRpY2xlID0gdGhpcy51cGRhdGVQb2ludENsb3VkUGFydGljbGVcbiAgICAgICAgICAgICAgICB0aGlzLnBvaW50Q2xvdWQuYWRkUG9pbnRzKEd1aWRlTGluZS5Qb2ludENvdW50KVxuICAgICAgICAgICAgICAgIHRoaXMucG9pbnRDbG91ZC5idWlsZE1lc2hBc3luYygpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnBvaW50Q2xvdWQubWVzaC52aXNpYmlsaXR5ID0gMC4xXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlKClcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1cGRhdGVQb2ludENsb3VkUGFydGljbGUgPSAocGFydGljbGUpID0+IHtcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZS5wb3NpdGlvbi5jb3B5RnJvbSh0aGlzLnBvaW50c1twYXJ0aWNsZS5pZHhdKVxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJ0aWNsZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1cGRhdGUgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFsbCA9IHRoaXMuYmFsbFBoeXNpY3NcbiAgICAgICAgICAgICAgICBjb25zdCBwb3NpdGlvbiA9IGJhbGwucG9zaXRpb25cblxuICAgICAgICAgICAgICAgIGJhbGwuZHJvcCgpXG4gICAgICAgICAgICAgICAgdGhpcy5wb2ludHNbMF0uY29weUZyb20ocG9zaXRpb24pXG5cbiAgICAgICAgICAgICAgICBsZXQgaSA9IDFcbiAgICAgICAgICAgICAgICBmb3IgKDsgaSA8IEd1aWRlTGluZS5Qb2ludENvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgYmFsbC50aWNrKClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wb2ludHNbaV0uY29weUZyb20ocG9zaXRpb24pXG4gICAgICAgICAgICAgICAgICAgIGlmIChwb3NpdGlvbi54IDwgLUJvdW5kc1dpZHRoIHx8IEJvdW5kc1dpZHRoIDwgcG9zaXRpb24ueCB8fCBwb3NpdGlvbi55IDwgLUJvdW5kc0hlaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFNldCBhbGwgbGVmdG92ZXIgcG9pbnRzIHRvIHRoZSBzYW1lIHBvc2l0aW9uIGFzIHRoZSBsYXN0IHBvaW50IGluc3RlYWQgb2YgZGVsZXRpbmcgdGhlbS5cbiAgICAgICAgICAgICAgICBmb3IgKDsgaSA8IEd1aWRlTGluZS5Qb2ludENvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wb2ludHNbaV0uY29weUZyb20ocG9zaXRpb24pXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5wb2ludENsb3VkLnNldFBhcnRpY2xlcygwLCBHdWlkZUxpbmUuUG9pbnRDb3VudClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vI2VuZHJlZ2lvblxuXG4gICAgLy8jcmVnaW9uIEdVSVxuXG4gICAgY29uc3QgZ3VpID0gbmV3IGNsYXNzIEd1aSB7XG4gICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB9XG5cbiAgICAgICAgZ2V0IG1vZGUoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fLm1vZGVcbiAgICAgICAgfVxuXG4gICAgICAgIF8gPSBuZXcgY2xhc3Mge1xuICAgICAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWFuYWdlciA9IG5ldyBCQUJZTE9OLkdVSS5HVUkzRE1hbmFnZXIoc2NlbmUpXG5cbiAgICAgICAgICAgICAgICBjb25zdCBicG1Eb3duQnV0dG9uID0gbmV3IEJBQllMT04uR1VJLkJ1dHRvbjNEKGBndWkuYnBtLmRvd25CdXR0b25gKVxuICAgICAgICAgICAgICAgIG1hbmFnZXIuYWRkQ29udHJvbChicG1Eb3duQnV0dG9uKVxuICAgICAgICAgICAgICAgIGJwbURvd25CdXR0b24uc2NhbGluZy5zZXQoMC4yLCAwLjIsIDAuMSlcbiAgICAgICAgICAgICAgICBicG1Eb3duQnV0dG9uLmNvbnRlbnQgPSBuZXcgQkFCWUxPTi5HVUkuVGV4dEJsb2NrKGBndWkuYnBtLmRvd25CdXR0b24udGV4dGAsIGAtYClcbiAgICAgICAgICAgICAgICBicG1Eb3duQnV0dG9uLmNvbnRlbnQuZm9udFNpemUgPSAyNFxuICAgICAgICAgICAgICAgIGJwbURvd25CdXR0b24uY29udGVudC5jb2xvciA9IGB3aGl0ZWBcbiAgICAgICAgICAgICAgICBicG1Eb3duQnV0dG9uLmNvbnRlbnQuc2NhbGVYID0gMSAvIGJwbURvd25CdXR0b24uc2NhbGluZy54XG4gICAgICAgICAgICAgICAgYnBtRG93bkJ1dHRvbi5jb250ZW50LnNjYWxlWSA9IDEgLyBicG1Eb3duQnV0dG9uLnNjYWxpbmcueVxuICAgICAgICAgICAgICAgIGJwbURvd25CdXR0b24ub25Qb2ludGVyQ2xpY2tPYnNlcnZhYmxlLmFkZCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNldEJwbShicG0gLSAxKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVVpVGV4dCgpXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvcExlZnRDb250cm9sKGJwbURvd25CdXR0b24pXG5cbiAgICAgICAgICAgICAgICBjb25zdCBicG1VcEJ1dHRvbiA9IG5ldyBCQUJZTE9OLkdVSS5CdXR0b24zRChgZ3VpLmJwbS51cEJ1dHRvbmApXG4gICAgICAgICAgICAgICAgbWFuYWdlci5hZGRDb250cm9sKGJwbVVwQnV0dG9uKVxuICAgICAgICAgICAgICAgIGJwbVVwQnV0dG9uLnNjYWxpbmcuc2V0KDAuMiwgMC4yLCAwLjEpXG4gICAgICAgICAgICAgICAgYnBtVXBCdXR0b24uY29udGVudCA9IG5ldyBCQUJZTE9OLkdVSS5UZXh0QmxvY2soYGd1aS5icG0udXBCdXR0b24udGV4dGAsIGArYClcbiAgICAgICAgICAgICAgICBicG1VcEJ1dHRvbi5jb250ZW50LmZvbnRTaXplID0gMjRcbiAgICAgICAgICAgICAgICBicG1VcEJ1dHRvbi5jb250ZW50LmNvbG9yID0gYHdoaXRlYFxuICAgICAgICAgICAgICAgIGJwbVVwQnV0dG9uLmNvbnRlbnQuc2NhbGVYID0gMSAvIGJwbVVwQnV0dG9uLnNjYWxpbmcueFxuICAgICAgICAgICAgICAgIGJwbVVwQnV0dG9uLmNvbnRlbnQuc2NhbGVZID0gMSAvIGJwbVVwQnV0dG9uLnNjYWxpbmcueVxuICAgICAgICAgICAgICAgIGJwbVVwQnV0dG9uLm9uUG9pbnRlckNsaWNrT2JzZXJ2YWJsZS5hZGQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzZXRCcG0oYnBtICsgMSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVVaVRleHQoKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRUb3BMZWZ0Q29udHJvbChicG1VcEJ1dHRvbilcblxuICAgICAgICAgICAgICAgIGNvbnN0IGJwbVRleHRCdXR0b24gPSBuZXcgQkFCWUxPTi5HVUkuQnV0dG9uM0QoYGd1aS5icG0udGV4dC5idXR0b25gKVxuICAgICAgICAgICAgICAgIG1hbmFnZXIuYWRkQ29udHJvbChicG1UZXh0QnV0dG9uKVxuICAgICAgICAgICAgICAgIGJwbVRleHRCdXR0b24uc2NhbGluZy5zZXQoMC41LCAwLjIsIDAuMSlcbiAgICAgICAgICAgICAgICBicG1UZXh0QnV0dG9uLm5vZGUuaXNQaWNrYWJsZSA9IGZhbHNlXG4gICAgICAgICAgICAgICAgYnBtVGV4dEJ1dHRvbi5tZXNoLm1hdGVyaWFsLmRpZmZ1c2VDb2xvci5zZXQoMC43NSwgMC43NSwgMC43NSlcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvcExlZnRDb250cm9sKGJwbVRleHRCdXR0b24pXG5cbiAgICAgICAgICAgICAgICBjb25zdCBicG1UZXh0ID0gbmV3IEJBQllMT04uR1VJLlRleHRCbG9jayhgZ3VpLmJwbS50ZXh0YClcbiAgICAgICAgICAgICAgICBicG1UZXh0QnV0dG9uLmNvbnRlbnQgPSBicG1UZXh0XG4gICAgICAgICAgICAgICAgYnBtVGV4dC5jb2xvciA9IGB3aGl0ZWBcbiAgICAgICAgICAgICAgICBicG1UZXh0LmZvbnRTaXplID0gMjRcbiAgICAgICAgICAgICAgICBicG1UZXh0LnRleHQgPSBgJHtCcG1EZWZhdWx0fSBicG1gXG4gICAgICAgICAgICAgICAgYnBtVGV4dC5zY2FsZVggPSAxIC8gYnBtVGV4dEJ1dHRvbi5zY2FsaW5nLnhcbiAgICAgICAgICAgICAgICBicG1UZXh0LnNjYWxlWSA9IDEgLyBicG1UZXh0QnV0dG9uLnNjYWxpbmcueVxuICAgICAgICAgICAgICAgIHRoaXMuYnBtVGV4dCA9IGJwbVRleHRcblxuICAgICAgICAgICAgICAgIGNvbnN0IGJwbVNsaWRlciA9IG5ldyBCQUJZTE9OLkdVSS5TbGlkZXIzRChgZ3VpLmJwbS5zbGlkZXJgKVxuICAgICAgICAgICAgICAgIG1hbmFnZXIuYWRkQ29udHJvbChicG1TbGlkZXIpXG4gICAgICAgICAgICAgICAgYnBtU2xpZGVyLnBvc2l0aW9uLnogPSAwLjA2NVxuICAgICAgICAgICAgICAgIGJwbVNsaWRlci5taW5pbXVtID0gQnBtTWluXG4gICAgICAgICAgICAgICAgYnBtU2xpZGVyLm1heGltdW0gPSBCcG1NYXhcbiAgICAgICAgICAgICAgICBicG1TbGlkZXIudmFsdWUgPSBCcG1EZWZhdWx0XG4gICAgICAgICAgICAgICAgYnBtU2xpZGVyLm9uVmFsdWVDaGFuZ2VkT2JzZXJ2YWJsZS5hZGQoKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNldEJwbShNYXRoLnJvdW5kKHZhbHVlKSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVVaVRleHQoKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRUb3BMZWZ0Q29udHJvbChicG1TbGlkZXIsIDAuOSlcbiAgICAgICAgICAgICAgICB0aGlzLmJwbVNsaWRlciA9IGJwbVNsaWRlclxuXG4gICAgICAgICAgICAgICAgY29uc3QgbW9kZUNhbWVyYUJ1dHRvbiA9IG5ldyBCQUJZTE9OLkdVSS5CdXR0b24zRChgZ3VpLm1vZGUuY2FtZXJhQnV0dG9uYClcbiAgICAgICAgICAgICAgICBtYW5hZ2VyLmFkZENvbnRyb2wobW9kZUNhbWVyYUJ1dHRvbilcbiAgICAgICAgICAgICAgICBtb2RlQ2FtZXJhQnV0dG9uLnNjYWxpbmcuc2V0KDAuNiwgMC4yLCAwLjEpXG4gICAgICAgICAgICAgICAgbW9kZUNhbWVyYUJ1dHRvbi5jb250ZW50ID0gbmV3IEJBQllMT04uR1VJLlRleHRCbG9jayhgZ3VpLm1vZGUuY2FtZXJhQnV0dG9uLnRleHRgLCBgQ2FtZXJhYClcbiAgICAgICAgICAgICAgICBtb2RlQ2FtZXJhQnV0dG9uLmNvbnRlbnQuY29sb3IgPSBgd2hpdGVgXG4gICAgICAgICAgICAgICAgbW9kZUNhbWVyYUJ1dHRvbi5jb250ZW50LmZvbnRTaXplID0gMjRcbiAgICAgICAgICAgICAgICBtb2RlQ2FtZXJhQnV0dG9uLmNvbnRlbnQuc2NhbGVYID0gMSAvIG1vZGVDYW1lcmFCdXR0b24uc2NhbGluZy54XG4gICAgICAgICAgICAgICAgbW9kZUNhbWVyYUJ1dHRvbi5jb250ZW50LnNjYWxlWSA9IDEgLyBtb2RlQ2FtZXJhQnV0dG9uLnNjYWxpbmcueVxuICAgICAgICAgICAgICAgIG1vZGVDYW1lcmFCdXR0b24ub25Qb2ludGVyQ2xpY2tPYnNlcnZhYmxlLmFkZCgoKSA9PiB7IHRoaXMuc3dpdGNoVG9DYW1lcmFNb2RlKCkgfSlcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvcFJpZ2h0Q29udHJvbChtb2RlQ2FtZXJhQnV0dG9uKVxuICAgICAgICAgICAgICAgIHRoaXMubW9kZUNhbWVyYUJ1dHRvbiA9IG1vZGVDYW1lcmFCdXR0b25cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1vZGVFcmFzZUJ1dHRvbiA9IG5ldyBCQUJZTE9OLkdVSS5CdXR0b24zRChgZ3VpLm1vZGUuZXJhc2VCdXR0b25gKVxuICAgICAgICAgICAgICAgIG1hbmFnZXIuYWRkQ29udHJvbChtb2RlRXJhc2VCdXR0b24pXG4gICAgICAgICAgICAgICAgbW9kZUVyYXNlQnV0dG9uLnNjYWxpbmcuc2V0KDAuNiwgMC4yLCAwLjEpXG4gICAgICAgICAgICAgICAgbW9kZUVyYXNlQnV0dG9uLmNvbnRlbnQgPSBuZXcgQkFCWUxPTi5HVUkuVGV4dEJsb2NrKGBndWkubW9kZS5lcmFzZUJ1dHRvbi50ZXh0YCwgYEVyYXNlYClcbiAgICAgICAgICAgICAgICBtb2RlRXJhc2VCdXR0b24uY29udGVudC5jb2xvciA9IGB3aGl0ZWBcbiAgICAgICAgICAgICAgICBtb2RlRXJhc2VCdXR0b24uY29udGVudC5mb250U2l6ZSA9IDI0XG4gICAgICAgICAgICAgICAgbW9kZUVyYXNlQnV0dG9uLmNvbnRlbnQuc2NhbGVYID0gMSAvIG1vZGVFcmFzZUJ1dHRvbi5zY2FsaW5nLnhcbiAgICAgICAgICAgICAgICBtb2RlRXJhc2VCdXR0b24uY29udGVudC5zY2FsZVkgPSAxIC8gbW9kZUVyYXNlQnV0dG9uLnNjYWxpbmcueVxuICAgICAgICAgICAgICAgIG1vZGVFcmFzZUJ1dHRvbi5vblBvaW50ZXJDbGlja09ic2VydmFibGUuYWRkKCgpID0+IHsgdGhpcy5zd2l0Y2hUb0VyYXNlTW9kZSgpIH0pXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRUb3BSaWdodENvbnRyb2wobW9kZUVyYXNlQnV0dG9uKVxuICAgICAgICAgICAgICAgIHRoaXMubW9kZUVyYXNlQnV0dG9uID0gbW9kZUVyYXNlQnV0dG9uXG5cbiAgICAgICAgICAgICAgICBjb25zdCBtb2RlRHJhd0J1dHRvbiA9IG5ldyBCQUJZTE9OLkdVSS5CdXR0b24zRChgZ3VpLm1vZGUuZHJhd0J1dHRvbmApXG4gICAgICAgICAgICAgICAgbWFuYWdlci5hZGRDb250cm9sKG1vZGVEcmF3QnV0dG9uKVxuICAgICAgICAgICAgICAgIG1vZGVEcmF3QnV0dG9uLnNjYWxpbmcuc2V0KDAuNiwgMC4yLCAwLjEpXG4gICAgICAgICAgICAgICAgbW9kZURyYXdCdXR0b24uY29udGVudCA9IG5ldyBCQUJZTE9OLkdVSS5UZXh0QmxvY2soYGd1aS5tb2RlLmRyYXdCdXR0b24udGV4dGAsIGBEcmF3YClcbiAgICAgICAgICAgICAgICBtb2RlRHJhd0J1dHRvbi5jb250ZW50LmNvbG9yID0gYHdoaXRlYFxuICAgICAgICAgICAgICAgIG1vZGVEcmF3QnV0dG9uLmNvbnRlbnQuZm9udFNpemUgPSAyNFxuICAgICAgICAgICAgICAgIG1vZGVEcmF3QnV0dG9uLmNvbnRlbnQuc2NhbGVYID0gMSAvIG1vZGVEcmF3QnV0dG9uLnNjYWxpbmcueFxuICAgICAgICAgICAgICAgIG1vZGVEcmF3QnV0dG9uLmNvbnRlbnQuc2NhbGVZID0gMSAvIG1vZGVEcmF3QnV0dG9uLnNjYWxpbmcueVxuICAgICAgICAgICAgICAgIG1vZGVEcmF3QnV0dG9uLm9uUG9pbnRlckNsaWNrT2JzZXJ2YWJsZS5hZGQoKCkgPT4geyB0aGlzLnN3aXRjaFRvRHJhd01vZGUoKSB9KVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9wUmlnaHRDb250cm9sKG1vZGVEcmF3QnV0dG9uKVxuICAgICAgICAgICAgICAgIHRoaXMubW9kZURyYXdCdXR0b24gPSBtb2RlRHJhd0J1dHRvblxuXG4gICAgICAgICAgICAgICAgdGhpcy5zd2l0Y2hUb0RyYXdNb2RlKClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYnBtU2xpZGVyID0gbnVsbFxuICAgICAgICAgICAgYnBtVGV4dCA9IG51bGxcbiAgICAgICAgICAgIG1vZGVEcmF3QnV0dG9uID0gbnVsbFxuICAgICAgICAgICAgbW9kZUVyYXNlQnV0dG9uID0gbnVsbFxuICAgICAgICAgICAgbW9kZUNhbWVyYUJ1dHRvbiA9IG51bGxcblxuICAgICAgICAgICAgZ2V0IHhMZWZ0KCkgeyByZXR1cm4gLUJvdW5kc1dpZHRoIC8gMiB9XG4gICAgICAgICAgICBnZXQgeVRvcCgpIHsgcmV0dXJuIEJvdW5kc0hlaWdodCAvIDIgKyAwLjEgfVxuXG4gICAgICAgICAgICBtYXJnaW4gPSAwLjAxXG4gICAgICAgICAgICB4Rm9yTmV4dFRvcExlZnRDb250cm9sID0gdGhpcy54TGVmdFxuICAgICAgICAgICAgeEZvck5leHRUb3BSaWdodENvbnRyb2wgPSB0aGlzLnhMZWZ0ICsgQm91bmRzV2lkdGhcblxuICAgICAgICAgICAgbW9kZSA9IGBgXG5cbiAgICAgICAgICAgIGFkZFRvcExlZnRDb250cm9sID0gKGNvbnRyb2wsIHdpZHRoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHdpZHRoID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IGNvbnRyb2wubWVzaFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBib3VuZHMgPSBtZXNoLmdldEJvdW5kaW5nSW5mbygpXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoID0gKGJvdW5kcy5tYXhpbXVtLnggLSBib3VuZHMubWluaW11bS54KSAqIG1lc2guc2NhbGluZy54XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29udHJvbC5wb3NpdGlvbi54ID0gdGhpcy54Rm9yTmV4dFRvcExlZnRDb250cm9sICsgd2lkdGggLyAyXG4gICAgICAgICAgICAgICAgY29udHJvbC5wb3NpdGlvbi55ID0gdGhpcy55VG9wXG5cbiAgICAgICAgICAgICAgICB0aGlzLnhGb3JOZXh0VG9wTGVmdENvbnRyb2wgKz0gd2lkdGggKyB0aGlzLm1hcmdpblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhZGRUb3BSaWdodENvbnRyb2wgPSAoY29udHJvbCwgd2lkdGgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAod2lkdGggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gY29udHJvbC5tZXNoXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJvdW5kcyA9IG1lc2guZ2V0Qm91bmRpbmdJbmZvKClcbiAgICAgICAgICAgICAgICAgICAgd2lkdGggPSAoYm91bmRzLm1heGltdW0ueCAtIGJvdW5kcy5taW5pbXVtLngpICogbWVzaC5zY2FsaW5nLnhcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb250cm9sLnBvc2l0aW9uLnggPSB0aGlzLnhGb3JOZXh0VG9wUmlnaHRDb250cm9sIC0gd2lkdGggLyAyXG4gICAgICAgICAgICAgICAgY29udHJvbC5wb3NpdGlvbi55ID0gdGhpcy55VG9wXG5cbiAgICAgICAgICAgICAgICB0aGlzLnhGb3JOZXh0VG9wUmlnaHRDb250cm9sIC09IHdpZHRoICsgdGhpcy5tYXJnaW5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc3dpdGNoVG9EcmF3TW9kZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGUgPSBgRHJhd01vZGVgXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVVaVRleHQoKVxuICAgICAgICAgICAgICAgIGNhbWVyYS5kZXRhY2hDb250cm9sKClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc3dpdGNoVG9FcmFzZU1vZGUgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlID0gYEVyYXNlTW9kZWBcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVVpVGV4dCgpXG4gICAgICAgICAgICAgICAgY2FtZXJhLmRldGFjaENvbnRyb2woKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzd2l0Y2hUb0NhbWVyYU1vZGUgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlID0gYENhbWVyYU1vZGVgXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVVaVRleHQoKVxuICAgICAgICAgICAgICAgIGNhbWVyYS5hdHRhY2hDb250cm9sKClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdXBkYXRlVWlUZXh0ID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuYnBtU2xpZGVyLnZhbHVlID0gYnBtXG4gICAgICAgICAgICAgICAgdGhpcy5icG1UZXh0LnRleHQgPSBgJHticG19IGJwbWBcblxuICAgICAgICAgICAgICAgIHRoaXMubW9kZURyYXdCdXR0b24ubWVzaC5tYXRlcmlhbC5kaWZmdXNlQ29sb3Iuc2V0KDAuNSwgMC41LCAwLjUpXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlRXJhc2VCdXR0b24ubWVzaC5tYXRlcmlhbC5kaWZmdXNlQ29sb3Iuc2V0KDAuNSwgMC41LCAwLjUpXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlQ2FtZXJhQnV0dG9uLm1lc2gubWF0ZXJpYWwuZGlmZnVzZUNvbG9yLnNldCgwLjUsIDAuNSwgMC41KVxuICAgICAgICAgICAgICAgIGxldCBjdXJyZW50TW9kZUJ1dHRvbiA9IG51bGxcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tb2RlID09PSBgRHJhd01vZGVgKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlQnV0dG9uID0gdGhpcy5tb2RlRHJhd0J1dHRvblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tb2RlID09PSBgRXJhc2VNb2RlYCkge1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50TW9kZUJ1dHRvbiA9IHRoaXMubW9kZUVyYXNlQnV0dG9uXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1vZGUgPT09IGBDYW1lcmFNb2RlYCkge1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50TW9kZUJ1dHRvbiA9IHRoaXMubW9kZUNhbWVyYUJ1dHRvblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJyZW50TW9kZUJ1dHRvbi5tZXNoLm1hdGVyaWFsLmRpZmZ1c2VDb2xvci5zZXQoMC45LCAwLjksIDAuOSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vI2VuZHJlZ2lvblxuXG4gICAgLy8jcmVnaW9uIFBvaW50ZXIgaGFuZGxpbmdcblxuICAgIGNvbnN0IGhpdFBvaW50UGxhbmVGb3JEcmF3aW5nID0gQkFCWUxPTi5NZXNoQnVpbGRlci5DcmVhdGVQbGFuZShgZHJhd2luZyBwbGFuZWAsIHsgd2lkdGg6IDIgKiBCb3VuZHNXaWR0aCwgaGVpZ2h0OiAyICogQm91bmRzSGVpZ2h0IH0pXG4gICAgaGl0UG9pbnRQbGFuZUZvckRyYXdpbmcudmlzaWJpbGl0eSA9IDBcbiAgICBsZXQgcGxhbmVCZWluZ0FkZGVkID0gbnVsbFxuXG4gICAgY29uc3Qgc3RhcnRBZGRpbmdQbGFuZSA9IChzdGFydFBvaW50KSA9PiB7XG4gICAgICAgIHN0YXJ0UG9pbnQueCA9IE1hdGgubWF4KC1IYWxmQm91bmRzV2lkdGgsIE1hdGgubWluKHN0YXJ0UG9pbnQueCwgSGFsZkJvdW5kc1dpZHRoKSlcbiAgICAgICAgc3RhcnRQb2ludC55ID0gTWF0aC5tYXgoLUhhbGZCb3VuZHNIZWlnaHQsIE1hdGgubWluKHN0YXJ0UG9pbnQueSwgSGFsZkJvdW5kc0hlaWdodCkpXG4gICAgICAgIHN0YXJ0UG9pbnQueiA9IDBcbiAgICAgICAgcGxhbmVCZWluZ0FkZGVkID0gbmV3IFBsYW5lKHN0YXJ0UG9pbnQpXG4gICAgfVxuXG4gICAgY29uc3QgZmluaXNoQWRkaW5nUGxhbmUgPSAoKSA9PiB7XG4gICAgICAgIGlmIChwbGFuZUJlaW5nQWRkZWQpIHtcbiAgICAgICAgICAgIHBsYW5lQmVpbmdBZGRlZC5mcmVlemUoKVxuICAgICAgICB9XG4gICAgICAgIHBsYW5lQmVpbmdBZGRlZCA9IG51bGxcbiAgICB9XG5cbiAgICBzY2VuZS5vblBvaW50ZXJPYnNlcnZhYmxlLmFkZCgocG9pbnRlckluZm8pID0+IHtcbiAgICAgICAgc3dpdGNoIChwb2ludGVySW5mby50eXBlKSB7XG4gICAgICAgICAgICBjYXNlIEJBQllMT04uUG9pbnRlckV2ZW50VHlwZXMuUE9JTlRFUkRPV046XG4gICAgICAgICAgICAgICAgaWYgKHBvaW50ZXJJbmZvLnBpY2tJbmZvLmhpdCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZ3VpLm1vZGUgPT09IGBEcmF3TW9kZWApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0QWRkaW5nUGxhbmUocG9pbnRlckluZm8ucGlja0luZm8ucGlja2VkUG9pbnQpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoZ3VpLm1vZGUgPT09IGBFcmFzZU1vZGVgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwaWNrZWRNZXNoID0gcG9pbnRlckluZm8ucGlja0luZm8ucGlja2VkTWVzaFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFBsYW5lLlBsYW5lTWVzaE1hcC5oYXMocGlja2VkTWVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBQbGFuZS5QbGFuZU1lc2hNYXAuZ2V0KHBpY2tlZE1lc2gpLmRpc2FibGUoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGd1aWRlbGluZS51cGRhdGUoKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgY2FzZSBCQUJZTE9OLlBvaW50ZXJFdmVudFR5cGVzLlBPSU5URVJNT1ZFOlxuICAgICAgICAgICAgICAgIGlmIChwbGFuZUJlaW5nQWRkZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGlja0luZm8gPSBzY2VuZS5waWNrKHNjZW5lLnBvaW50ZXJYLCBzY2VuZS5wb2ludGVyWSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBpY2tJbmZvLmhpdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGlja2VkUG9pbnQgPSBwaWNrSW5mby5waWNrZWRQb2ludFxuICAgICAgICAgICAgICAgICAgICAgICAgcGlja2VkUG9pbnQueCA9IE1hdGgubWF4KC1IYWxmQm91bmRzV2lkdGgsIE1hdGgubWluKHBpY2tlZFBvaW50LngsIEhhbGZCb3VuZHNXaWR0aCkpXG4gICAgICAgICAgICAgICAgICAgICAgICBwaWNrZWRQb2ludC55ID0gTWF0aC5tYXgoLUhhbGZCb3VuZHNIZWlnaHQsIE1hdGgubWluKHBpY2tlZFBvaW50LnksIEhhbGZCb3VuZHNIZWlnaHQpKVxuICAgICAgICAgICAgICAgICAgICAgICAgcGlja2VkUG9pbnQueiA9IDBcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYW5lQmVpbmdBZGRlZC5lbmRQb2ludCA9IHBpY2tlZFBvaW50XG4gICAgICAgICAgICAgICAgICAgICAgICBndWlkZWxpbmUudXBkYXRlKClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIGNhc2UgQkFCWUxPTi5Qb2ludGVyRXZlbnRUeXBlcy5QT0lOVEVSVVA6XG4gICAgICAgICAgICAgICAgZmluaXNoQWRkaW5nUGxhbmUoKVxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICB9KVxuXG4gICAgLy8jZW5kcmVnaW9uXG5cbiAgICAvLyNyZWdpb24gWFJcblxuICAgIGNvbnN0IHN0YXJ0WHIgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB4ciA9IGF3YWl0IHNjZW5lLmNyZWF0ZURlZmF1bHRYUkV4cGVyaWVuY2VBc3luYyh7fSlcbiAgICAgICAgICAgIGlmICghIXhyICYmICEheHIuZW50ZXJFeGl0VUkpIHtcbiAgICAgICAgICAgICAgICB4ci5lbnRlckV4aXRVSS5hY3RpdmVCdXR0b25DaGFuZ2VkT2JzZXJ2YWJsZS5hZGQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBCQUJZTE9OLkVuZ2luZS5hdWRpb0VuZ2luZS51bmxvY2soKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2goZSkge1xuICAgICAgICAgICAgY29uc29sZS5kZWJ1ZyhlKVxuICAgICAgICB9XG4gICAgfVxuICAgIHN0YXJ0WHIoKVxuXG4gICAgLy8jZW5kcmVnaW9uXG5cbiAgICByZXR1cm4gc2NlbmVcbn1cblxuZnVuY3Rpb24gaXNJbkJhYnlsb25QbGF5Z3JvdW5kKCkge1xuICAgIHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGctcm9vdCcpICE9PSBudWxsXG59XG5cbmlmICghaXNJbkJhYnlsb25QbGF5Z3JvdW5kKCkpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVNjZW5lXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IEJBQllMT047IiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGdldERlZmF1bHRFeHBvcnQgZnVuY3Rpb24gZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBub24taGFybW9ueSBtb2R1bGVzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLm4gPSAobW9kdWxlKSA9PiB7XG5cdHZhciBnZXR0ZXIgPSBtb2R1bGUgJiYgbW9kdWxlLl9fZXNNb2R1bGUgP1xuXHRcdCgpID0+IChtb2R1bGVbJ2RlZmF1bHQnXSkgOlxuXHRcdCgpID0+IChtb2R1bGUpO1xuXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmQoZ2V0dGVyLCB7IGE6IGdldHRlciB9KTtcblx0cmV0dXJuIGdldHRlcjtcbn07IiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5nID0gKGZ1bmN0aW9uKCkge1xuXHRpZiAodHlwZW9mIGdsb2JhbFRoaXMgPT09ICdvYmplY3QnKSByZXR1cm4gZ2xvYmFsVGhpcztcblx0dHJ5IHtcblx0XHRyZXR1cm4gdGhpcyB8fCBuZXcgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdGlmICh0eXBlb2Ygd2luZG93ID09PSAnb2JqZWN0JykgcmV0dXJuIHdpbmRvdztcblx0fVxufSkoKTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0ICogYXMgQkFCWUxPTiBmcm9tICdiYWJ5bG9uanMnXG5cbmNvbnN0IGNyZWF0ZVNjZW5lID0gcmVxdWlyZSgnLi9wbGF5Z3JvdW5kLmpzJylcbi8vIGNvbnN0IGNyZWF0ZVNjZW5lID0gcmVxdWlyZSgnLi9yZWZsZWN0aW9ucy5qcycpXG5cbmdsb2JhbC5jYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnY2FudmFzJylbMF1cbmdsb2JhbC5lbmdpbmUgPSBuZXcgQkFCWUxPTi5FbmdpbmUoY2FudmFzLCB0cnVlLCB7IGF1ZGlvRW5naW5lOiB0cnVlLCBhdWRpb0VuZ2luZU9wdGlvbnM6IHtcbiAgICBhdWRpb0NvbnRleHQ6IG5ldyBBdWRpb0NvbnRleHRcbn19KVxuXG5jb25zdCBzY2VuZSA9IGNyZWF0ZVNjZW5lKClcblxuZW5naW5lLnJ1blJlbmRlckxvb3AoKCkgPT4ge1xuICAgIHNjZW5lLnJlbmRlcigpO1xufSlcblxub25yZXNpemUgPSAoKSA9PiB7XG4gICAgZW5naW5lLnJlc2l6ZSgpXG59XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=