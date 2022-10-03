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
    const PhysicsTickInMs = 4
    const ToneBaseNote = 33 // 55 hz

    const HalfPI = Math.PI / 2
    const TwoPI = 2 * Math.PI

    const HalfBoundsWidth = BoundsWidth / 2
    const HalfBoundsHeight = BoundsHeight / 2
    const HalfPhysicsBoundsWidth = PhysicsBoundsWidth / 2
    const HalfPhysicsBoundsHeight = PhysicsBoundsHeight / 2
    const BallRadius = BoundsWidth / 60
    const BallHueIncrement = 360 / BallPoolCount
    const MaxPlaneWidth = Math.sqrt(BoundsWidth * BoundsWidth + BoundsHeight * BoundsHeight)
    const PhysicsTickInSeconds = PhysicsTickInMs / 1000
    const PhysicsTickInSecondsSquared = PhysicsTickInSeconds * PhysicsTickInSeconds
    const PhysicsTickInSecondsSquaredTimesGravity = PhysicsTickInSecondsSquared * Gravity

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

    const toDegrees = (value) => {
        return (value / TwoPI) * 360
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
    planeMeshPrototype.scaling.z = 0.01
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBLHNDQUFzQyxlQUFlO0FBQ3JEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHlFQUF5RTtBQUN6RTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQSx1RkFBdUYsU0FBUztBQUNoRztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBLDRCQUE0Qix3QkFBd0I7QUFDcEQ7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLCtEQUErRCx3RUFBd0U7O0FBRXZJO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUEsZ0VBQWdFLG9DQUFvQztBQUNwRzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSw0QkFBNEIsbUJBQW1CO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSx5Q0FBeUM7QUFDekM7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLDRCQUE0QixtQkFBbUI7QUFDL0M7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxTQUFTO0FBQ1QsS0FBSzs7QUFFTDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxnREFBZ0Qsa0JBQWtCO0FBQ2xFO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSw0QkFBNEIscUJBQXFCO0FBQ2pEO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDs7QUFFQTs7QUFFQTtBQUNBO0FBQ0Esd0JBQXdCLHdCQUF3QjtBQUNoRDtBQUNBO0FBQ0EsS0FBSzs7QUFFTDs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxnRkFBZ0YsaUJBQWlCOztBQUVqRztBQUNBLGdDQUFnQywwQkFBMEI7QUFDMUQ7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0EsdUJBQXVCLDBCQUEwQjtBQUNqRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSx1QkFBdUIsMEJBQTBCO0FBQ2pEO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtDQUFrQyxZQUFZO0FBQzlDO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0VBQXNFLDJCQUEyQjtBQUNqRztBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxRUFBcUUsMEJBQTBCO0FBQy9GO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9FQUFvRSx5QkFBeUI7QUFDN0Y7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsMEJBQTBCO0FBQzFCLHlCQUF5Qjs7QUFFekI7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsdUNBQXVDLEtBQUs7O0FBRTVDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUEsdUZBQXVGLGtEQUFrRDtBQUN6STtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7O0FBRUw7O0FBRUE7O0FBRUE7QUFDQTtBQUNBLG9FQUFvRTtBQUNwRTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7QUM5NkJBOzs7Ozs7VUNBQTtVQUNBOztVQUVBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBOztVQUVBO1VBQ0E7O1VBRUE7VUFDQTtVQUNBOzs7OztXQ3RCQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0EsaUNBQWlDLFdBQVc7V0FDNUM7V0FDQTs7Ozs7V0NQQTtXQUNBO1dBQ0E7V0FDQTtXQUNBLHlDQUF5Qyx3Q0FBd0M7V0FDakY7V0FDQTtXQUNBOzs7OztXQ1BBO1dBQ0E7V0FDQTtXQUNBO1dBQ0EsR0FBRztXQUNIO1dBQ0E7V0FDQSxDQUFDOzs7OztXQ1BEOzs7OztXQ0FBO1dBQ0E7V0FDQTtXQUNBLHVEQUF1RCxpQkFBaUI7V0FDeEU7V0FDQSxnREFBZ0QsYUFBYTtXQUM3RDs7Ozs7Ozs7Ozs7Ozs7QUNOb0M7O0FBRXBDLG9CQUFvQixtQkFBTyxDQUFDLDRDQUFpQjtBQUM3Qzs7QUFFQSxxQkFBTTtBQUNOLHFCQUFNLGNBQWMsNkNBQWMsaUJBQWlCO0FBQ25EO0FBQ0EsRUFBRTs7QUFFRjs7QUFFQTtBQUNBO0FBQ0EsQ0FBQzs7QUFFRDtBQUNBO0FBQ0EiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9zcmMvcGxheWdyb3VuZC5qcyIsIndlYnBhY2s6Ly8vZXh0ZXJuYWwgdmFyIFwiQkFCWUxPTlwiIiwid2VicGFjazovLy93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly8vd2VicGFjay9ydW50aW1lL2NvbXBhdCBnZXQgZGVmYXVsdCBleHBvcnQiLCJ3ZWJwYWNrOi8vL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly8vd2VicGFjay9ydW50aW1lL2dsb2JhbCIsIndlYnBhY2s6Ly8vd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly8vd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly8vLi9zcmMvYXBwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlxudmFyIGNyZWF0ZVNjZW5lID0gZnVuY3Rpb24gKCkge1xuICAgIC8vI3JlZ2lvbiBDb25zdGFudHNcblxuICAgIGNvbnN0IEJvdW5kc1dpZHRoID0gNVxuICAgIGNvbnN0IEJvdW5kc0hlaWdodCA9IEJvdW5kc1dpZHRoXG4gICAgY29uc3QgQmFsbFBvb2xDb3VudCA9IDEwMDBcbiAgICBjb25zdCBCYWxsUmVzdGl0dXRpb24gPSAwLjk4XG4gICAgY29uc3QgQnBtRGVmYXVsdCA9IDYwXG4gICAgY29uc3QgQnBtTWluID0gMVxuICAgIGNvbnN0IEJwbU1heCA9IDI0MFxuICAgIGNvbnN0IEdyYXZpdHkgPSAzXG4gICAgY29uc3QgUGh5c2ljc0JvdW5kc1dpZHRoID0gMS4yNSAqIEJvdW5kc1dpZHRoXG4gICAgY29uc3QgUGh5c2ljc0JvdW5kc0hlaWdodCA9IDEuMjUgKiBCb3VuZHNIZWlnaHRcbiAgICBjb25zdCBQaHlzaWNzVGlja0luTXMgPSA0XG4gICAgY29uc3QgVG9uZUJhc2VOb3RlID0gMzMgLy8gNTUgaHpcblxuICAgIGNvbnN0IEhhbGZQSSA9IE1hdGguUEkgLyAyXG4gICAgY29uc3QgVHdvUEkgPSAyICogTWF0aC5QSVxuXG4gICAgY29uc3QgSGFsZkJvdW5kc1dpZHRoID0gQm91bmRzV2lkdGggLyAyXG4gICAgY29uc3QgSGFsZkJvdW5kc0hlaWdodCA9IEJvdW5kc0hlaWdodCAvIDJcbiAgICBjb25zdCBIYWxmUGh5c2ljc0JvdW5kc1dpZHRoID0gUGh5c2ljc0JvdW5kc1dpZHRoIC8gMlxuICAgIGNvbnN0IEhhbGZQaHlzaWNzQm91bmRzSGVpZ2h0ID0gUGh5c2ljc0JvdW5kc0hlaWdodCAvIDJcbiAgICBjb25zdCBCYWxsUmFkaXVzID0gQm91bmRzV2lkdGggLyA2MFxuICAgIGNvbnN0IEJhbGxIdWVJbmNyZW1lbnQgPSAzNjAgLyBCYWxsUG9vbENvdW50XG4gICAgY29uc3QgTWF4UGxhbmVXaWR0aCA9IE1hdGguc3FydChCb3VuZHNXaWR0aCAqIEJvdW5kc1dpZHRoICsgQm91bmRzSGVpZ2h0ICogQm91bmRzSGVpZ2h0KVxuICAgIGNvbnN0IFBoeXNpY3NUaWNrSW5TZWNvbmRzID0gUGh5c2ljc1RpY2tJbk1zIC8gMTAwMFxuICAgIGNvbnN0IFBoeXNpY3NUaWNrSW5TZWNvbmRzU3F1YXJlZCA9IFBoeXNpY3NUaWNrSW5TZWNvbmRzICogUGh5c2ljc1RpY2tJblNlY29uZHNcbiAgICBjb25zdCBQaHlzaWNzVGlja0luU2Vjb25kc1NxdWFyZWRUaW1lc0dyYXZpdHkgPSBQaHlzaWNzVGlja0luU2Vjb25kc1NxdWFyZWQgKiBHcmF2aXR5XG5cbiAgICAvLyNlbmRyZWdpb25cblxuICAgIC8vI3JlZ2lvbiBUdW5pbmdcblxuICAgIGNvbnN0IHR1bmluZyA9IG5ldyBjbGFzcyBUdW5pbmcge1xuICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgfVxuXG4gICAgICAgIGZyZXF1ZW5jeUZyb21QbGFuZVNjYWxlWCA9IChwbGFuZVNjYWxlWCkgPT4ge1xuICAgICAgICAgICAgbGV0IGkgPSBNYXhQbGFuZVdpZHRoIC0gcGxhbmVTY2FsZVhcbiAgICAgICAgICAgIGkgLz0gTWF4UGxhbmVXaWR0aFxuICAgICAgICAgICAgaSAqPSB0aGlzLl8ubm90ZXMubGVuZ3RoIC0gMVxuICAgICAgICAgICAgaSA9IE1hdGgucm91bmQoaSlcbiAgICAgICAgICAgIGNvbnN0IG5vdGUgPSB0aGlzLl8ubm90ZXNbaV1cbiAgICAgICAgICAgIGNvbnN0IGh6ID0gTWF0aC5wb3coMiwgKG5vdGUgLSBUb25lQmFzZU5vdGUpIC8gMTIpXG4gICAgICAgICAgICByZXR1cm4gaHpcbiAgICAgICAgfVxuXG4gICAgICAgIF8gPSBuZXcgY2xhc3Mge1xuICAgICAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRUb1dob2xlVG9uZVNjYWxlKDM2LCA5NilcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm90ZXMgPSBbXVxuXG4gICAgICAgICAgICBzZXRUb1dob2xlVG9uZVNjYWxlID0gKGxvd05vdGUsIGhpZ2hOb3RlKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3Rlcy5sZW5ndGggPSAwXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IGxvd05vdGU7IGkgPD0gaGlnaE5vdGU7IGkrPTIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ub3Rlcy5wdXNoKGkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8jZW5kcmVnaW9uXG5cbiAgICAvLyNyZWdpb24gU2NlbmUgc2V0dXBcblxuICAgIGNvbnN0IHNjZW5lID0gbmV3IEJBQllMT04uU2NlbmUoZW5naW5lKVxuXG4gICAgY29uc3QgY2FtZXJhID0gbmV3IEJBQllMT04uQXJjUm90YXRlQ2FtZXJhKGBjYW1lcmFgLCAtSGFsZlBJLCBIYWxmUEksIEJvdW5kc1dpZHRoICogMS41LCBCQUJZTE9OLlZlY3RvcjMuWmVyb1JlYWRPbmx5KVxuICAgIGNhbWVyYS5hdHRhY2hDb250cm9sKClcblxuICAgIGNvbnN0IGxpZ2h0ID0gbmV3IEJBQllMT04uSGVtaXNwaGVyaWNMaWdodChgbGlnaHRgLCBuZXcgQkFCWUxPTi5WZWN0b3IzKDAsIDEsIDApLCBzY2VuZSlcbiAgICBsaWdodC5pbnRlbnNpdHkgPSAwLjdcblxuICAgIC8vI2VuZHJlZ2lvblxuXG4gICAgLy8jcmVnaW9uIEdlb21ldHJ5IGZ1bmN0aW9uc1xuXG4gICAgY29uc3QgaW50ZXJzZWN0aW9uID0gKGExLCBhMiwgYjEsIGIyLCBvdXQpID0+IHtcbiAgICAgICAgLy8gUmV0dXJuIGBmYWxzZWAgaWYgb25lIG9mIHRoZSBsaW5lIGxlbmd0aHMgaXMgemVyby5cbiAgICAgICAgaWYgKChhMS54ID09PSBhMi54ICYmIGExLnkgPT09IGEyLnkpIHx8IChiMS54ID09PSBiMi54ICYmIGIxLnkgPT09IGIyLnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgfVxuXG4gICAgICAgIGRlbm9taW5hdG9yID0gKChiMi55IC0gYjEueSkgKiAoYTIueCAtIGExLngpIC0gKGIyLnggLSBiMS54KSAqIChhMi55IC0gYTEueSkpXG5cbiAgICAgICAgLy8gUmV0dXJuIGBmYWxzZWAgaWYgbGluZXMgYXJlIHBhcmFsbGVsLlxuICAgICAgICBpZiAoZGVub21pbmF0b3IgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHVhID0gKChiMi54IC0gYjEueCkgKiAoYTEueSAtIGIxLnkpIC0gKGIyLnkgLSBiMS55KSAqIChhMS54IC0gYjEueCkpIC8gZGVub21pbmF0b3JcbiAgICAgICAgbGV0IHViID0gKChhMi54IC0gYTEueCkgKiAoYTEueSAtIGIxLnkpIC0gKGEyLnkgLSBhMS55KSAqIChhMS54IC0gYjEueCkpIC8gZGVub21pbmF0b3JcblxuICAgICAgICAvLyBSZXR1cm4gYGZhbHNlYCBpZiB0aGUgaW50ZXJzZWN0aW9uIGlzIG5vdCBvbiB0aGUgc2VnbWVudHMuXG4gICAgICAgIGlmICh1YSA8IDAgfHwgMSA8IHVhIHx8IHViIDwgMCB8fCAxIDwgdWIpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0IG91dCB2ZWN0b3IncyB4IGFuZCB5IGNvb3JkaW5hdGVzLlxuICAgICAgICBvdXQueCA9IGExLnggKyB1YSAqIChhMi54IC0gYTEueClcbiAgICAgICAgb3V0LnkgPSBhMS55ICsgdWEgKiAoYTIueSAtIGExLnkpXG5cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICBjb25zdCB0b0RlZ3JlZXMgPSAodmFsdWUpID0+IHtcbiAgICAgICAgcmV0dXJuICh2YWx1ZSAvIFR3b1BJKSAqIDM2MFxuICAgIH1cblxuICAgIC8vI2VuZHJlZ2lvblxuXG4gICAgLy8jcmVnaW9uIGNsYXNzIEJvcmRlclxuICAgIGNvbnN0IGJvcmRlciA9IG5ldyBjbGFzcyBCb3JkZXIge1xuICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgfVxuXG4gICAgICAgIF8gPSBuZXcgY2xhc3Mge1xuICAgICAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IEJBQllMT04uTWVzaEJ1aWxkZXIuQ3JlYXRlTGluZXMoYGJvcmRlcmAsIHsgcG9pbnRzOiBbXG4gICAgICAgICAgICAgICAgICAgIG5ldyBCQUJZTE9OLlZlY3RvcjMoLUhhbGZCb3VuZHNXaWR0aCwgIEhhbGZCb3VuZHNIZWlnaHQsIDApLFxuICAgICAgICAgICAgICAgICAgICBuZXcgQkFCWUxPTi5WZWN0b3IzKCBIYWxmQm91bmRzV2lkdGgsICBIYWxmQm91bmRzSGVpZ2h0LCAwKSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IEJBQllMT04uVmVjdG9yMyggSGFsZkJvdW5kc1dpZHRoLCAtSGFsZkJvdW5kc0hlaWdodCwgMCksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBCQUJZTE9OLlZlY3RvcjMoLUhhbGZCb3VuZHNXaWR0aCwgLUhhbGZCb3VuZHNIZWlnaHQsIDApLFxuICAgICAgICAgICAgICAgICAgICBuZXcgQkFCWUxPTi5WZWN0b3IzKC1IYWxmQm91bmRzV2lkdGgsICBIYWxmQm91bmRzSGVpZ2h0LCAwKVxuICAgICAgICAgICAgICAgIF19KVxuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IEJBQllMT04uU3RhbmRhcmRNYXRlcmlhbChgYm9yZGVyLm1hdGVyaWFsYClcbiAgICAgICAgICAgICAgICBtZXNoLm1hdGVyaWFsID0gbWF0ZXJpYWxcbiAgICAgICAgICAgICAgICBtZXNoLmlzUGlja2FibGUgPSBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8jZW5kcmVnaW9uXG5cbiAgICAvLyNyZWdpb24gY2xhc3MgUGxhbmVcblxuICAgIGNvbnN0IHBsYW5lTWVzaFByb3RvdHlwZSA9IEJBQllMT04uTWVzaEJ1aWxkZXIuQ3JlYXRlQm94KGBwbGFuZSBtZXNoIHByb3RvdHlwZWAsIHsgc2l6ZTogMSB9KVxuICAgIHBsYW5lTWVzaFByb3RvdHlwZS5zY2FsaW5nLnkgPSAwLjI1XG4gICAgcGxhbmVNZXNoUHJvdG90eXBlLnNjYWxpbmcueiA9IDAuMDFcbiAgICBwbGFuZU1lc2hQcm90b3R5cGUuaXNQaWNrYWJsZSA9IGZhbHNlXG4gICAgcGxhbmVNZXNoUHJvdG90eXBlLmlzVmlzaWJsZSA9IGZhbHNlXG4gICAgcGxhbmVNZXNoUHJvdG90eXBlLm1hdGVyaWFsID0gbmV3IEJBQllMT04uU3RhbmRhcmRNYXRlcmlhbChgcGxhbmUubWF0ZXJpYWxgKVxuICAgIHBsYW5lTWVzaFByb3RvdHlwZS5tYXRlcmlhbC5kaWZmdXNlQ29sb3Iuc2V0KDAuMSwgMC4xLCAwLjEpXG4gICAgcGxhbmVNZXNoUHJvdG90eXBlLm1hdGVyaWFsLmVtaXNzaXZlQ29sb3Iuc2V0KDAuMSwgMC4xLCAwLjEpXG5cbiAgICBjbGFzcyBQbGFuZSB7XG4gICAgICAgIHN0YXRpYyBBcnJheSA9IFtdXG4gICAgICAgIHN0YXRpYyBQbGFuZU1lc2hNYXAgPSBuZXcgV2Vha01hcFxuXG4gICAgICAgIGNvbnN0cnVjdG9yKHN0YXJ0UG9pbnQpIHtcbiAgICAgICAgICAgIHRoaXMuXy5zdGFydFBvaW50LmNvcHlGcm9tKHN0YXJ0UG9pbnQpXG4gICAgICAgIH1cblxuICAgICAgICBnZXQgc3RhcnRQb2ludCgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl8uc3RhcnRQb2ludFxuICAgICAgICB9XG5cbiAgICAgICAgZ2V0IGVuZFBvaW50KCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuXy5lbmRQb2ludFxuICAgICAgICB9XG5cbiAgICAgICAgc2V0IGVuZFBvaW50KHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuXy5tZXNoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fLmluaXRpYWxpemVNZXNoKClcbiAgICAgICAgICAgICAgICBQbGFuZS5BcnJheS5wdXNoKHRoaXMpXG4gICAgICAgICAgICAgICAgUGxhbmUuUGxhbmVNZXNoTWFwLnNldCh0aGlzLl8ubWVzaCwgdGhpcylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuXy5lbmRQb2ludC5jb3B5RnJvbSh2YWx1ZSlcbiAgICAgICAgICAgIHRoaXMuXy5yZXNldFBvaW50cygpXG4gICAgICAgIH1cblxuICAgICAgICBnZXQgYW5nbGUoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fLmFuZ2xlXG4gICAgICAgIH1cblxuICAgICAgICBnZXQgcGxheWJhY2tSYXRlKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuXy5wbGF5YmFja1JhdGVcbiAgICAgICAgfVxuXG4gICAgICAgIGZyZWV6ZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICghIXRoaXMuXy5tZXNoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fLm1lc2guaXNQaWNrYWJsZSA9IHRydWVcbiAgICAgICAgICAgICAgICB0aGlzLl8ubWVzaC5mcmVlemVXb3JsZE1hdHJpeCgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXNldFBvaW50cyA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuXy5yZXNldFBvaW50cygpXG4gICAgICAgIH1cblxuICAgICAgICBkaXNhYmxlID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBQbGFuZS5BcnJheS5pbmRleE9mKHRoaXMpXG4gICAgICAgICAgICBpZiAoLTEgPCBpbmRleCkge1xuICAgICAgICAgICAgICBQbGFuZS5BcnJheS5zcGxpY2UoaW5kZXgsIDEpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBQbGFuZS5QbGFuZU1lc2hNYXAuZGVsZXRlKHRoaXMuXy5tZXNoKVxuICAgICAgICAgICAgdGhpcy5fLmRpc2FibGUoKVxuICAgICAgICAgICAgdGhpcy5fID0gbnVsbFxuICAgICAgICB9XG5cbiAgICAgICAgb25Db2xsaWRlID0gKGNvbG9yLCBjb2xsaXNpb25TdHJlbmd0aCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fLm9uQ29sbGlkZShjb2xvciwgY29sbGlzaW9uU3RyZW5ndGgpXG4gICAgICAgIH1cblxuICAgICAgICByZW5kZXIgPSAoZGVsdGFUaW1lKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl8ucmVuZGVyKGRlbHRhVGltZSlcbiAgICAgICAgfVxuXG4gICAgICAgIF8gPSBuZXcgY2xhc3Mge1xuICAgICAgICAgICAgc3RhcnRQb2ludCA9IG5ldyBCQUJZTE9OLlZlY3RvcjNcbiAgICAgICAgICAgIGVuZFBvaW50ID0gbmV3IEJBQllMT04uVmVjdG9yM1xuICAgICAgICAgICAgYW5nbGUgPSAwXG4gICAgICAgICAgICBwbGF5YmFja1JhdGUgPSAxXG4gICAgICAgICAgICBtZXNoID0gbnVsbFxuICAgICAgICAgICAgY29sb3IgPSBuZXcgQkFCWUxPTi5Db2xvcjNcblxuICAgICAgICAgICAgaW5pdGlhbGl6ZU1lc2ggPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IHRoaXMubWVzaCA9IHBsYW5lTWVzaFByb3RvdHlwZS5jbG9uZShgcGxhbmVgKVxuICAgICAgICAgICAgICAgIG1lc2gubWF0ZXJpYWwgPSBtZXNoLm1hdGVyaWFsLmNsb25lKGBgKVxuICAgICAgICAgICAgICAgIHRoaXMuY29sb3IgPSBtZXNoLm1hdGVyaWFsLmRpZmZ1c2VDb2xvclxuXG4gICAgICAgICAgICAgICAgbWVzaC5pc1Zpc2libGUgPSB0cnVlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJlc2V0UG9pbnRzID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSB0aGlzLm1lc2hcbiAgICAgICAgICAgICAgICBtZXNoLnNjYWxpbmcueCA9IEJBQllMT04uVmVjdG9yMy5EaXN0YW5jZSh0aGlzLnN0YXJ0UG9pbnQsIHRoaXMuZW5kUG9pbnQpXG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5YmFja1JhdGUgPSB0dW5pbmcuZnJlcXVlbmN5RnJvbVBsYW5lU2NhbGVYKG1lc2guc2NhbGluZy54KVxuXG4gICAgICAgICAgICAgICAgQkFCWUxPTi5WZWN0b3IzLkNlbnRlclRvUmVmKHRoaXMuc3RhcnRQb2ludCwgdGhpcy5lbmRQb2ludCwgbWVzaC5wb3NpdGlvbilcblxuICAgICAgICAgICAgICAgIG1lc2gucm90YXRpb25RdWF0ZXJuaW9uID0gbnVsbFxuICAgICAgICAgICAgICAgIG1lc2gucm90YXRlQXJvdW5kKG1lc2gucG9zaXRpb24sIEJBQllMT04uVmVjdG9yMy5SaWdodFJlYWRPbmx5LCBIYWxmUEkpXG5cbiAgICAgICAgICAgICAgICBsZXQgYW5nbGUgPSBNYXRoLmF0YW4yKHRoaXMuZW5kUG9pbnQueSAtIHRoaXMuc3RhcnRQb2ludC55LCB0aGlzLmVuZFBvaW50LnggLSB0aGlzLnN0YXJ0UG9pbnQueClcbiAgICAgICAgICAgICAgICBtZXNoLnJvdGF0ZUFyb3VuZChtZXNoLnBvc2l0aW9uLCBCQUJZTE9OLlZlY3RvcjMuUmlnaHRIYW5kZWRGb3J3YXJkUmVhZE9ubHksIC1hbmdsZSlcblxuICAgICAgICAgICAgICAgIGlmIChhbmdsZSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYW5nbGUgKz0gVHdvUElcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5hbmdsZSA9IGFuZ2xlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRpc2FibGUgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5tZXNoLmlzVmlzaWJsZSA9IGZhbHNlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG9uQ29sbGlkZSA9IChjb2xvciwgY29sb3JTdHJlbmd0aCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY29sb3IuciA9IE1hdGgubWF4KHRoaXMuY29sb3IuciwgY29sb3JTdHJlbmd0aCAqIGNvbG9yLnIpXG4gICAgICAgICAgICAgICAgdGhpcy5jb2xvci5nID0gTWF0aC5tYXgodGhpcy5jb2xvci5nLCBjb2xvclN0cmVuZ3RoICogY29sb3IuZylcbiAgICAgICAgICAgICAgICB0aGlzLmNvbG9yLmIgPSBNYXRoLm1heCh0aGlzLmNvbG9yLmIsIGNvbG9yU3RyZW5ndGggKiBjb2xvci5iKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZW5kZXIgPSAoZGVsdGFUaW1lKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRlbHRhVGltZSAqPSAzXG4gICAgICAgICAgICAgICAgdGhpcy5jb2xvci5yIC09IGRlbHRhVGltZVxuICAgICAgICAgICAgICAgIHRoaXMuY29sb3IuZyAtPSBkZWx0YVRpbWVcbiAgICAgICAgICAgICAgICB0aGlzLmNvbG9yLmIgLT0gZGVsdGFUaW1lXG4gICAgICAgICAgICAgICAgdGhpcy5jb2xvci5yID0gTWF0aC5tYXgoMC4xLCB0aGlzLmNvbG9yLnIpXG4gICAgICAgICAgICAgICAgdGhpcy5jb2xvci5nID0gTWF0aC5tYXgoMC4xLCB0aGlzLmNvbG9yLmcpXG4gICAgICAgICAgICAgICAgdGhpcy5jb2xvci5iID0gTWF0aC5tYXgoMC4xLCB0aGlzLmNvbG9yLmIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyNlbmRyZWdpb25cblxuICAgIC8vI3JlZ2lvbiBjbGFzcyBCYWxsUGh5c2ljc1xuXG4gICAgY2xhc3MgQmFsbFBoeXNpY3Mge1xuICAgICAgICBzdGF0aWMgU3RhcnRQb3NpdGlvbiA9IG5ldyBCQUJZTE9OLlZlY3RvcjMoLUhhbGZCb3VuZHNXaWR0aCAqIDAuNzUsIEhhbGZCb3VuZHNIZWlnaHQgKiAwLjk1LCAwKVxuICAgICAgICBzdGF0aWMgSW50ZXJzZWN0aW9uUG9pbnQgPSBuZXcgQkFCWUxPTi5WZWN0b3IzXG5cbiAgICAgICAgb25Db2xsaWRlT2JzZXJ2YWJsZSA9IG5ldyBCQUJZTE9OLk9ic2VydmFibGVcbiAgICAgICAgcG9zaXRpb24gPSBuZXcgQkFCWUxPTi5WZWN0b3IzKDAsIC0xMDAwLCAwKVxuXG4gICAgICAgIHByZXZpb3VzUG9zaXRpb24gPSBuZXcgQkFCWUxPTi5WZWN0b3IzXG4gICAgICAgIHZlbG9jaXR5ID0gbmV3IEJBQllMT04uVmVjdG9yM1xuXG4gICAgICAgIGRyb3AgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBvc2l0aW9uLmNvcHlGcm9tKEJhbGxQaHlzaWNzLlN0YXJ0UG9zaXRpb24pXG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzUG9zaXRpb24uY29weUZyb20oQmFsbFBoeXNpY3MuU3RhcnRQb3NpdGlvbilcbiAgICAgICAgICAgIHRoaXMudmVsb2NpdHkuc2V0KDAsIDAsIDApXG4gICAgICAgIH1cblxuICAgICAgICB0aWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wcmV2aW91c1Bvc2l0aW9uLmNvcHlGcm9tKHRoaXMucG9zaXRpb24pXG4gICAgICAgICAgICB0aGlzLnBvc2l0aW9uLnNldChcbiAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uLnggKyB0aGlzLnZlbG9jaXR5LngsXG4gICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbi55ICsgdGhpcy52ZWxvY2l0eS55LFxuICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24ueiArIHRoaXMudmVsb2NpdHkuelxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgdGhpcy52ZWxvY2l0eS55IC09IFBoeXNpY3NUaWNrSW5TZWNvbmRzU3F1YXJlZFRpbWVzR3Jhdml0eVxuXG4gICAgICAgICAgICAvLyBTa2lwIHBsYW5lIGludGVyc2VjdGlvbiBjYWxjdWxhdGlvbnMgd2hlbiBiYWxsIGlzIG91dCBvZiBib3VuZHMuXG4gICAgICAgICAgICBpZiAodGhpcy5wb3NpdGlvbi54IDwgLUhhbGZQaHlzaWNzQm91bmRzV2lkdGhcbiAgICAgICAgICAgICAgICAgICAgfHwgSGFsZlBoeXNpY3NCb3VuZHNXaWR0aCA8IHRoaXMucG9zaXRpb24ueFxuICAgICAgICAgICAgICAgICAgICB8fCB0aGlzLnBvc2l0aW9uLnkgPCAtSGFsZlBoeXNpY3NCb3VuZHNIZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgfHwgSGFsZlBoeXNpY3NCb3VuZHNIZWlnaHQgPCB0aGlzLnBvc2l0aW9uLnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBiYWxsQW5nbGUgPSBNYXRoLmF0YW4yKHRoaXMudmVsb2NpdHkueSwgdGhpcy52ZWxvY2l0eS54KVxuICAgICAgICAgICAgaWYgKGJhbGxBbmdsZSA8IDApIHtcbiAgICAgICAgICAgICAgICBiYWxsQW5nbGUgKz0gVHdvUElcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGxhc3RQbGFuZUhpdCA9IG51bGxcblxuICAgICAgICAgICAgbGV0IGxvb3BSZXNldENvdW50ID0gMFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBQbGFuZS5BcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBsYW5lID0gUGxhbmUuQXJyYXlbaV1cblxuICAgICAgICAgICAgICAgIGlmIChpbnRlcnNlY3Rpb24odGhpcy5wcmV2aW91c1Bvc2l0aW9uLCB0aGlzLnBvc2l0aW9uLCBwbGFuZS5zdGFydFBvaW50LCBwbGFuZS5lbmRQb2ludCwgQmFsbC5pbnRlcnNlY3Rpb25Qb2ludCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxhc3RQbGFuZUhpdCA9PT0gcGxhbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbGFzdFBsYW5lSGl0ID0gcGxhbmVcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzcGVlZCA9IHRoaXMudmVsb2NpdHkubGVuZ3RoKCkgKiBCYWxsUmVzdGl0dXRpb25cblxuICAgICAgICAgICAgICAgICAgICBsZXQgZGlmZmVyZW5jZUFuZ2xlID0gcGxhbmUuYW5nbGUgLSBiYWxsQW5nbGVcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRpZmZlcmVuY2VBbmdsZSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpZmZlcmVuY2VBbmdsZSArPSBUd29QSVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJldmlvdXNCYWxsQW5nbGUgPSBiYWxsQW5nbGVcbiAgICAgICAgICAgICAgICAgICAgYmFsbEFuZ2xlID0gcGxhbmUuYW5nbGUgKyBkaWZmZXJlbmNlQW5nbGVcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJhbGxBbmdsZSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhbGxBbmdsZSArPSBUd29QSVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkNvbGxpZGVPYnNlcnZhYmxlLm5vdGlmeU9ic2VydmVycyh7IHBsYW5lOiBwbGFuZSwgYm91bmNlQW5nbGU6IHByZXZpb3VzQmFsbEFuZ2xlIC0gYmFsbEFuZ2xlLCBzcGVlZDogc3BlZWQgfSlcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnZlbG9jaXR5LnNldChcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwZWVkICogTWF0aC5jb3MoYmFsbEFuZ2xlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwZWVkICogTWF0aC5zaW4oYmFsbEFuZ2xlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIDBcbiAgICAgICAgICAgICAgICAgICAgKVxuXG5cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByZXZpb3VzUG9zaXRpb24uY29weUZyb20oQmFsbC5pbnRlcnNlY3Rpb25Qb2ludClcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbi5zZXQoXG4gICAgICAgICAgICAgICAgICAgICAgICBCYWxsLmludGVyc2VjdGlvblBvaW50LnggKyB0aGlzLnZlbG9jaXR5LngsXG4gICAgICAgICAgICAgICAgICAgICAgICBCYWxsLmludGVyc2VjdGlvblBvaW50LnkgKyB0aGlzLnZlbG9jaXR5LnksXG4gICAgICAgICAgICAgICAgICAgICAgICAwXG4gICAgICAgICAgICAgICAgICAgIClcblxuICAgICAgICAgICAgICAgICAgICAvLyBUZXN0IGVhY2ggcGxhbmUgZm9yIGludGVyc2VjdGlvbnMgYWdhaW4gd2l0aCB0aGUgdXBkYXRlZCBwb3NpdGlvbnMuXG4gICAgICAgICAgICAgICAgICAgIGkgPSAwXG4gICAgICAgICAgICAgICAgICAgIGxvb3BSZXNldENvdW50ICs9IDFcbiAgICAgICAgICAgICAgICAgICAgaWYgKDEwIDwgbG9vcFJlc2V0Q291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyNlbmRyZWdpb25cblxuICAgIC8vI3JlZ2lvbiBjbGFzcyBCYWxsXG5cbiAgICBjb25zdCBCYWxsTWVzaCA9IEJBQllMT04uTWVzaEJ1aWxkZXIuQ3JlYXRlU3BoZXJlKGBiYWxsYCwgeyBkaWFtZXRlcjogQmFsbFJhZGl1cywgc2VnbWVudHM6IDE2IH0sIHNjZW5lKVxuICAgIEJhbGxNZXNoLmlzVmlzaWJsZSA9IGZhbHNlXG5cbiAgICBjbGFzcyBCYWxsIHtcbiAgICAgICAgc3RhdGljIFN0YXJ0UG9zaXRpb24gPSBuZXcgQkFCWUxPTi5WZWN0b3IzKC1Cb3VuZHNXaWR0aCAqIDAuMzc1LCBCb3VuZHNIZWlnaHQgKiAwLjM3NSwgMClcbiAgICAgICAgc3RhdGljIEh1ZSA9IDBcbiAgICAgICAgc3RhdGljIGludGVyc2VjdGlvblBvaW50ID0gbmV3IEJBQllMT04uVmVjdG9yM1xuXG4gICAgICAgIHN0YXRpYyBJbnN0YW5jZUNvbG9ycyA9IG5ldyBGbG9hdDMyQXJyYXkoNCAqIEJhbGxQb29sQ291bnQpXG4gICAgICAgIHN0YXRpYyBJbnN0YW5jZU1hdHJpY2VzID0gbmV3IEZsb2F0MzJBcnJheSgxNiAqIEJhbGxQb29sQ291bnQpXG4gICAgICAgIHN0YXRpYyBJbnN0YW5jZU1hdHJpY2VzRGlydHkgPSB0cnVlXG4gICAgICAgIHN0YXRpYyBJbnN0YW5jZUNvbG9yc0RpcnR5ID0gdHJ1ZVxuXG4gICAgICAgIHN0YXRpYyBDcmVhdGVJbnN0YW5jZXMgPSAoKSA9PiB7XG4gICAgICAgICAgICBCYWxsLkluc3RhbmNlQ29sb3JzLmZpbGwoMClcbiAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VNYXRyaWNlcy5maWxsKDApXG5cbiAgICAgICAgICAgIC8vIFNldCBtYXRyaWNlcyB0byBpZGVudGl0eS5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgQmFsbFBvb2xDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0cml4SW5kZXggPSAxNiAqIGlcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlTWF0cmljZXNbbWF0cml4SW5kZXhdID0gMVxuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VNYXRyaWNlc1ttYXRyaXhJbmRleCArIDVdID0gMVxuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VNYXRyaWNlc1ttYXRyaXhJbmRleCArIDEwXSA9IDFcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlTWF0cmljZXNbbWF0cml4SW5kZXggKyAxNV0gPSAxXG5cbiAgICAgICAgICAgICAgICBjb25zdCBiYWxsID0gYmFsbFBvb2xbaV1cbiAgICAgICAgICAgICAgICBjb25zdCBjb2xvciA9IGJhbGwuY29sb3JcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xvckluZGV4ID0gNCAqIGlcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlQ29sb3JzW2NvbG9ySW5kZXhdID0gY29sb3IuclxuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VDb2xvcnNbY29sb3JJbmRleCArIDFdID0gY29sb3IuZ1xuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VDb2xvcnNbY29sb3JJbmRleCArIDJdID0gY29sb3IuYlxuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VDb2xvcnNbY29sb3JJbmRleCArIDNdID0gMFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBCYWxsTWVzaC50aGluSW5zdGFuY2VTZXRCdWZmZXIoYG1hdHJpeGAsIEJhbGwuSW5zdGFuY2VNYXRyaWNlcywgMTYsIGZhbHNlKVxuICAgICAgICAgICAgQmFsbE1lc2gudGhpbkluc3RhbmNlU2V0QnVmZmVyKGBjb2xvcmAsIEJhbGwuSW5zdGFuY2VDb2xvcnMsIDQsIGZhbHNlKVxuICAgICAgICAgICAgQmFsbC5VcGRhdGVJbnN0YW5jZXMoKVxuXG4gICAgICAgICAgICBCYWxsTWVzaC5pc1Zpc2libGUgPSB0cnVlXG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgVXBkYXRlSW5zdGFuY2VzID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKEJhbGwuSW5zdGFuY2VNYXRyaWNlc0RpcnR5KSB7XG4gICAgICAgICAgICAgICAgQmFsbC5JbnN0YW5jZU1hdHJpY2VzRGlydHkgPSBmYWxzZVxuICAgICAgICAgICAgICAgIEJhbGxNZXNoLnRoaW5JbnN0YW5jZUJ1ZmZlclVwZGF0ZWQoYG1hdHJpeGApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoQmFsbC5JbnN0YW5jZUNvbG9yc0RpcnR5KSB7XG4gICAgICAgICAgICAgICAgQmFsbC5JbnN0YW5jZUNvbG9yc0RpcnR5ID0gZmFsc2VcbiAgICAgICAgICAgICAgICBCYWxsTWVzaC50aGluSW5zdGFuY2VCdWZmZXJVcGRhdGVkKGBjb2xvcmApXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdHJ1Y3RvcihpbmRleCwgdG9uZSkge1xuICAgICAgICAgICAgdGhpcy5fLmluZGV4ID0gaW5kZXhcbiAgICAgICAgICAgIHRoaXMuXy5jb2xvckluZGV4ID0gNCAqIGluZGV4XG4gICAgICAgICAgICB0aGlzLl8ubWF0cml4SW5kZXggPSAxNiAqIGluZGV4XG4gICAgICAgICAgICB0aGlzLl8udG9uZSA9IHRvbmVcblxuICAgICAgICAgICAgQkFCWUxPTi5Db2xvcjMuSFNWdG9SR0JUb1JlZihCYWxsLkh1ZSwgMC43NSwgMSwgdGhpcy5fLmNvbG9yKVxuICAgICAgICAgICAgQmFsbC5IdWUgKz0gQmFsbEh1ZUluY3JlbWVudFxuXG4gICAgICAgICAgICB0aGlzLl8udXBkYXRlSW5zdGFuY2VDb2xvcigpXG4gICAgICAgICAgICB0aGlzLl8udXBkYXRlSW5zdGFuY2VQb3NpdGlvbigpXG4gICAgICAgIH1cblxuICAgICAgICBnZXQgY29sb3IoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fLmNvbG9yXG4gICAgICAgIH1cblxuICAgICAgICBnZXQgcG9zaXRpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fLmN1cnJlbnRQb3NpdGlvblxuICAgICAgICB9XG5cbiAgICAgICAgZHJvcCA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuXy5kcm9wKClcbiAgICAgICAgfVxuXG4gICAgICAgIHJlbmRlciA9IChkZWx0YVRpbWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMuXy5yZW5kZXIoZGVsdGFUaW1lKVxuICAgICAgICB9XG5cbiAgICAgICAgXyA9IG5ldyBjbGFzcyB7XG4gICAgICAgICAgICBpbmRleCA9IDBcbiAgICAgICAgICAgIGNvbG9ySW5kZXggPSAwXG4gICAgICAgICAgICBtYXRyaXhJbmRleCA9IDBcbiAgICAgICAgICAgIGlzVmlzaWJsZSA9IGZhbHNlXG4gICAgICAgICAgICB0b25lID0gbnVsbFxuICAgICAgICAgICAgY29sb3IgPSBuZXcgQkFCWUxPTi5Db2xvcjNcbiAgICAgICAgICAgIGJhbGxQaHlzaWNzID0gbmV3IEJhbGxQaHlzaWNzXG4gICAgICAgICAgICBsYXN0UGh5c2ljc1RpY2tJbk1zID0gMFxuXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJhbGxQaHlzaWNzLm9uQ29sbGlkZU9ic2VydmFibGUuYWRkKHRoaXMub25Db2xsaWRlKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1cGRhdGVJbnN0YW5jZUNvbG9yID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9ySW5kZXggPSB0aGlzLmNvbG9ySW5kZXhcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xvciA9IHRoaXMuY29sb3JcbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlQ29sb3JzW2NvbG9ySW5kZXhdID0gY29sb3IuclxuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VDb2xvcnNbY29sb3JJbmRleCArIDFdID0gY29sb3IuZ1xuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VDb2xvcnNbY29sb3JJbmRleCArIDJdID0gY29sb3IuYlxuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VDb2xvcnNbY29sb3JJbmRleCArIDNdID0gdGhpcy5pc1Zpc2libGUgPyAxIDogMFxuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VDb2xvcnNEaXJ0eSA9IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdXBkYXRlSW5zdGFuY2VQb3NpdGlvbiA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRyaXhJbmRleCA9IHRoaXMubWF0cml4SW5kZXhcbiAgICAgICAgICAgICAgICBjb25zdCBwb3NpdGlvbiA9IHRoaXMuYmFsbFBoeXNpY3MucG9zaXRpb25cbiAgICAgICAgICAgICAgICBCYWxsLkluc3RhbmNlTWF0cmljZXNbbWF0cml4SW5kZXggKyAxMl0gPSBwb3NpdGlvbi54XG4gICAgICAgICAgICAgICAgQmFsbC5JbnN0YW5jZU1hdHJpY2VzW21hdHJpeEluZGV4ICsgMTNdID0gcG9zaXRpb24ueVxuICAgICAgICAgICAgICAgIEJhbGwuSW5zdGFuY2VNYXRyaWNlc0RpcnR5ID0gdHJ1ZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkcm9wID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuYmFsbFBoeXNpY3MuZHJvcCgpXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVJbnN0YW5jZVBvc2l0aW9uKClcblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5pc1Zpc2libGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pc1Zpc2libGUgPSB0cnVlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlSW5zdGFuY2VDb2xvcigpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBvbkNvbGxpZGUgPSAoZXZlbnREYXRhKSA9PiB7IC8vIHBsYW5lLCBib3VuY2VBbmdsZSwgc3BlZWQpID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgYm91bmNlQW5nbGUgPSBNYXRoLmFicyhldmVudERhdGEuYm91bmNlQW5nbGUpXG4gICAgICAgICAgICAgICAgaWYgKGJvdW5jZUFuZ2xlIDwgMC4xKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHRvbmUgPSB0aGlzLnRvbmVcbiAgICAgICAgICAgICAgICB0b25lLnNldFBsYXliYWNrUmF0ZShldmVudERhdGEucGxhbmUucGxheWJhY2tSYXRlKVxuICAgICAgICAgICAgICAgIGxldCB2b2x1bWUgPSBNYXRoLm1pbihib3VuY2VBbmdsZSAqIGV2ZW50RGF0YS5zcGVlZCAqIDEwLCAxKVxuICAgICAgICAgICAgICAgIGNvbnN0IGFtcGxpdHVkZSA9IE1hdGgucG93KDIsIHZvbHVtZSkgLSAxXG4gICAgICAgICAgICAgICAgdG9uZS5zZXRWb2x1bWUoYW1wbGl0dWRlKVxuICAgICAgICAgICAgICAgIHRvbmUucGxheSgpXG5cbiAgICAgICAgICAgICAgICBsZXQgY29sb3JTdHJlbmd0aCA9IHZvbHVtZVxuICAgICAgICAgICAgICAgIGNvbG9yU3RyZW5ndGggPSAoTWF0aC5sb2coY29sb3JTdHJlbmd0aCArIDAuMDEpIC8gTWF0aC5sb2coMTAwKSkgKyAxXG4gICAgICAgICAgICAgICAgY29sb3JTdHJlbmd0aCA9IChNYXRoLmxvZyhjb2xvclN0cmVuZ3RoICsgMC4wMSkgLyBNYXRoLmxvZygxMDApKSArIDFcbiAgICAgICAgICAgICAgICBldmVudERhdGEucGxhbmUub25Db2xsaWRlKHRoaXMuY29sb3IsIGNvbG9yU3RyZW5ndGgpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG9uUGh5c2ljc1RpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5iYWxsUGh5c2ljcy50aWNrKClcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RhbmNlUG9zaXRpb24oKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZW5kZXIgPSAoZGVsdGFUaW1lSW5NcykgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMubGFzdFBoeXNpY3NUaWNrSW5NcyArPSBkZWx0YVRpbWVJbk1zXG4gICAgICAgICAgICAgICAgd2hpbGUgKFBoeXNpY3NUaWNrSW5NcyA8IHRoaXMubGFzdFBoeXNpY3NUaWNrSW5Ncykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uUGh5c2ljc1RpY2soKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmxhc3RQaHlzaWNzVGlja0luTXMgLT0gUGh5c2ljc1RpY2tJbk1zXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgYmFsbFBvb2wgPSBuZXcgQXJyYXkoQmFsbFBvb2xDb3VudClcblxuICAgIC8vI2VuZHJlZ2lvblxuXG4gICAgLy8jcmVnaW9uIEJhbGwgaGFuZGxpbmdcblxuICAgIGxldCBiYWxsc1JlYWR5ID0gZmFsc2VcblxuICAgIEJBQllMT04uRW5naW5lLmF1ZGlvRW5naW5lLmxvY2soKVxuICAgIEJBQllMT04uRW5naW5lLmF1ZGlvRW5naW5lLm9uQXVkaW9VbmxvY2tlZE9ic2VydmFibGUuYWRkT25jZSgoKSA9PiB7XG4gICAgICAgIGNvbnN0IHRvbmUgPSBuZXcgQkFCWUxPTi5Tb3VuZChgdG9uZWAsIGB0b25lLndhdmAsIHNjZW5lLCAoKSA9PiB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IEJhbGxQb29sQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhbGwgPSBuZXcgQmFsbChpLCB0b25lLmNsb25lKGBgKSlcbiAgICAgICAgICAgICAgICBiYWxsUG9vbFtpXSA9IGJhbGxcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYmFsbHNSZWFkeSA9IHRydWVcbiAgICAgICAgICAgIEJhbGwuQ3JlYXRlSW5zdGFuY2VzKClcbiAgICAgICAgfSlcbiAgICB9KVxuXG4gICAgbGV0IG5leHRCYWxsUG9vbEluZGV4ID0gMFxuXG4gICAgY29uc3QgZHJvcEJhbGwgPSAoKSA9PiB7XG4gICAgICAgIGlmICghYmFsbHNSZWFkeSkge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICAvLyBjb25zb2xlLmRlYnVnKGBkcm9wcGluZyBiYWxsIGluZGV4ICR7bmV4dEJhbGxQb29sSW5kZXh9YClcbiAgICAgICAgY29uc3QgYmFsbCA9IGJhbGxQb29sW25leHRCYWxsUG9vbEluZGV4XVxuICAgICAgICBiYWxsLmRyb3AoKVxuICAgICAgICBuZXh0QmFsbFBvb2xJbmRleCA9IChuZXh0QmFsbFBvb2xJbmRleCArIDEpICUgQmFsbFBvb2xDb3VudFxuICAgIH1cblxuICAgIGxldCBicG0gPSBCcG1EZWZhdWx0XG4gICAgbGV0IGJhbGxEcm9wVGltZVBlcmlvZEluTXMgPSAxMDAwICogKDYwIC8gQnBtRGVmYXVsdClcblxuICAgIGNvbnN0IHNldEJwbSA9ICh2YWx1ZSkgPT4ge1xuICAgICAgICBicG0gPSBNYXRoLm1heChCcG1NaW4sIE1hdGgubWluKHZhbHVlLCBCcG1NYXgpKVxuICAgICAgICBiYWxsRHJvcFRpbWVQZXJpb2RJbk1zID0gMTAwMCAqICg2MCAvIGJwbSlcbiAgICB9XG5cbiAgICBsZXQgdGltZUZyb21MYXN0QmFsbERyb3BJbk1zID0gMFxuXG4gICAgc2NlbmUucmVnaXN0ZXJCZWZvcmVSZW5kZXIoKCkgPT4ge1xuICAgICAgICBjb25zdCBkZWx0YVRpbWVJbk1zID0gZW5naW5lLmdldERlbHRhVGltZSgpXG4gICAgICAgIHRpbWVGcm9tTGFzdEJhbGxEcm9wSW5NcyArPSBkZWx0YVRpbWVJbk1zXG4gICAgICAgIGlmIChiYWxsRHJvcFRpbWVQZXJpb2RJbk1zIDwgdGltZUZyb21MYXN0QmFsbERyb3BJbk1zKSB7XG4gICAgICAgICAgICB0aW1lRnJvbUxhc3RCYWxsRHJvcEluTXMgLT0gYmFsbERyb3BUaW1lUGVyaW9kSW5Nc1xuICAgICAgICAgICAgZHJvcEJhbGwoKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGJhbGxzUmVhZHkpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYmFsbFBvb2wubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBiYWxsUG9vbFtpXS5yZW5kZXIoZGVsdGFUaW1lSW5NcylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIEJhbGwuVXBkYXRlSW5zdGFuY2VzKClcbiAgICAgICAgfVxuICAgIH0pXG5cbiAgICAvLyNlbmRyZWdpb25cblxuICAgIC8vI3JlZ2lvbiBQbGFuZSBoYW5kbGluZ1xuXG4gICAgc2NlbmUucmVnaXN0ZXJCZWZvcmVSZW5kZXIoKCkgPT4ge1xuICAgICAgICBjb25zdCBkZWx0YVRpbWUgPSBlbmdpbmUuZ2V0RGVsdGFUaW1lKCkgLyAxMDAwXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgUGxhbmUuQXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIFBsYW5lLkFycmF5W2ldLnJlbmRlcihkZWx0YVRpbWUpXG4gICAgICAgIH1cbiAgICB9KVxuXG4gICAgLy8jZW5kcmVnaW9uXG5cbiAgICAvLyNyZWdpb24gY2xhc3MgR3VpZGVMaW5lXG5cbiAgICBjb25zdCBndWlkZWxpbmUgPSBuZXcgY2xhc3MgR3VpZGVMaW5lIHtcbiAgICAgICAgc3RhdGljIFBvaW50Q291bnQgPSAxMDAwMDBcblxuICAgICAgICB1cGRhdGUgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl8udXBkYXRlKClcbiAgICAgICAgfVxuXG4gICAgICAgIF8gPSBuZXcgY2xhc3Mge1xuICAgICAgICAgICAgYmFsbFBoeXNpY3MgPSBuZXcgQmFsbFBoeXNpY3NcbiAgICAgICAgICAgIHBvaW50cyA9IG5ldyBBcnJheShHdWlkZUxpbmUuUG9pbnRDb3VudClcbiAgICAgICAgICAgIHBvaW50Q2xvdWQgPSBuZXcgQkFCWUxPTi5Qb2ludHNDbG91ZFN5c3RlbShgZ3VpZGVsaW5lYCwgMiwgc2NlbmUsIHsgdXBkYXRhYmxlOiB0cnVlIH0pXG5cbiAgICAgICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgR3VpZGVMaW5lLlBvaW50Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnBvaW50c1tpXSA9IG5ldyBCQUJZTE9OLlZlY3RvcjNcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnBvaW50Q2xvdWQudXBkYXRlUGFydGljbGUgPSB0aGlzLnVwZGF0ZVBvaW50Q2xvdWRQYXJ0aWNsZVxuICAgICAgICAgICAgICAgIHRoaXMucG9pbnRDbG91ZC5hZGRQb2ludHMoR3VpZGVMaW5lLlBvaW50Q291bnQpXG4gICAgICAgICAgICAgICAgdGhpcy5wb2ludENsb3VkLmJ1aWxkTWVzaEFzeW5jKCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucG9pbnRDbG91ZC5tZXNoLnZpc2liaWxpdHkgPSAwLjFcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGUoKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHVwZGF0ZVBvaW50Q2xvdWRQYXJ0aWNsZSA9IChwYXJ0aWNsZSkgPT4ge1xuICAgICAgICAgICAgICAgIHBhcnRpY2xlLnBvc2l0aW9uLmNvcHlGcm9tKHRoaXMucG9pbnRzW3BhcnRpY2xlLmlkeF0pXG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnRpY2xlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHVwZGF0ZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYWxsID0gdGhpcy5iYWxsUGh5c2ljc1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uID0gYmFsbC5wb3NpdGlvblxuXG4gICAgICAgICAgICAgICAgYmFsbC5kcm9wKClcbiAgICAgICAgICAgICAgICB0aGlzLnBvaW50c1swXS5jb3B5RnJvbShwb3NpdGlvbilcblxuICAgICAgICAgICAgICAgIGxldCBpID0gMVxuICAgICAgICAgICAgICAgIGZvciAoOyBpIDwgR3VpZGVMaW5lLlBvaW50Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBiYWxsLnRpY2soKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBvaW50c1tpXS5jb3B5RnJvbShwb3NpdGlvbilcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBvc2l0aW9uLnggPCAtQm91bmRzV2lkdGggfHwgQm91bmRzV2lkdGggPCBwb3NpdGlvbi54IHx8IHBvc2l0aW9uLnkgPCAtQm91bmRzSGVpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gU2V0IGFsbCBsZWZ0b3ZlciBwb2ludHMgdG8gdGhlIHNhbWUgcG9zaXRpb24gYXMgdGhlIGxhc3QgcG9pbnQgaW5zdGVhZCBvZiBkZWxldGluZyB0aGVtLlxuICAgICAgICAgICAgICAgIGZvciAoOyBpIDwgR3VpZGVMaW5lLlBvaW50Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnBvaW50c1tpXS5jb3B5RnJvbShwb3NpdGlvbilcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnBvaW50Q2xvdWQuc2V0UGFydGljbGVzKDAsIEd1aWRlTGluZS5Qb2ludENvdW50KVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8jZW5kcmVnaW9uXG5cbiAgICAvLyNyZWdpb24gR1VJXG5cbiAgICBjb25zdCBndWkgPSBuZXcgY2xhc3MgR3VpIHtcbiAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIH1cblxuICAgICAgICBnZXQgbW9kZSgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl8ubW9kZVxuICAgICAgICB9XG5cbiAgICAgICAgXyA9IG5ldyBjbGFzcyB7XG4gICAgICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYW5hZ2VyID0gbmV3IEJBQllMT04uR1VJLkdVSTNETWFuYWdlcihzY2VuZSlcblxuICAgICAgICAgICAgICAgIGNvbnN0IGJwbURvd25CdXR0b24gPSBuZXcgQkFCWUxPTi5HVUkuQnV0dG9uM0QoYGd1aS5icG0uZG93bkJ1dHRvbmApXG4gICAgICAgICAgICAgICAgbWFuYWdlci5hZGRDb250cm9sKGJwbURvd25CdXR0b24pXG4gICAgICAgICAgICAgICAgYnBtRG93bkJ1dHRvbi5zY2FsaW5nLnNldCgwLjIsIDAuMiwgMC4xKVxuICAgICAgICAgICAgICAgIGJwbURvd25CdXR0b24uY29udGVudCA9IG5ldyBCQUJZTE9OLkdVSS5UZXh0QmxvY2soYGd1aS5icG0uZG93bkJ1dHRvbi50ZXh0YCwgYC1gKVxuICAgICAgICAgICAgICAgIGJwbURvd25CdXR0b24uY29udGVudC5mb250U2l6ZSA9IDI0XG4gICAgICAgICAgICAgICAgYnBtRG93bkJ1dHRvbi5jb250ZW50LmNvbG9yID0gYHdoaXRlYFxuICAgICAgICAgICAgICAgIGJwbURvd25CdXR0b24uY29udGVudC5zY2FsZVggPSAxIC8gYnBtRG93bkJ1dHRvbi5zY2FsaW5nLnhcbiAgICAgICAgICAgICAgICBicG1Eb3duQnV0dG9uLmNvbnRlbnQuc2NhbGVZID0gMSAvIGJwbURvd25CdXR0b24uc2NhbGluZy55XG4gICAgICAgICAgICAgICAgYnBtRG93bkJ1dHRvbi5vblBvaW50ZXJDbGlja09ic2VydmFibGUuYWRkKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2V0QnBtKGJwbSAtIDEpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVWlUZXh0KClcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9wTGVmdENvbnRyb2woYnBtRG93bkJ1dHRvbilcblxuICAgICAgICAgICAgICAgIGNvbnN0IGJwbVVwQnV0dG9uID0gbmV3IEJBQllMT04uR1VJLkJ1dHRvbjNEKGBndWkuYnBtLnVwQnV0dG9uYClcbiAgICAgICAgICAgICAgICBtYW5hZ2VyLmFkZENvbnRyb2woYnBtVXBCdXR0b24pXG4gICAgICAgICAgICAgICAgYnBtVXBCdXR0b24uc2NhbGluZy5zZXQoMC4yLCAwLjIsIDAuMSlcbiAgICAgICAgICAgICAgICBicG1VcEJ1dHRvbi5jb250ZW50ID0gbmV3IEJBQllMT04uR1VJLlRleHRCbG9jayhgZ3VpLmJwbS51cEJ1dHRvbi50ZXh0YCwgYCtgKVxuICAgICAgICAgICAgICAgIGJwbVVwQnV0dG9uLmNvbnRlbnQuZm9udFNpemUgPSAyNFxuICAgICAgICAgICAgICAgIGJwbVVwQnV0dG9uLmNvbnRlbnQuY29sb3IgPSBgd2hpdGVgXG4gICAgICAgICAgICAgICAgYnBtVXBCdXR0b24uY29udGVudC5zY2FsZVggPSAxIC8gYnBtVXBCdXR0b24uc2NhbGluZy54XG4gICAgICAgICAgICAgICAgYnBtVXBCdXR0b24uY29udGVudC5zY2FsZVkgPSAxIC8gYnBtVXBCdXR0b24uc2NhbGluZy55XG4gICAgICAgICAgICAgICAgYnBtVXBCdXR0b24ub25Qb2ludGVyQ2xpY2tPYnNlcnZhYmxlLmFkZCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNldEJwbShicG0gKyAxKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVVpVGV4dCgpXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvcExlZnRDb250cm9sKGJwbVVwQnV0dG9uKVxuXG4gICAgICAgICAgICAgICAgY29uc3QgYnBtVGV4dEJ1dHRvbiA9IG5ldyBCQUJZTE9OLkdVSS5CdXR0b24zRChgZ3VpLmJwbS50ZXh0LmJ1dHRvbmApXG4gICAgICAgICAgICAgICAgbWFuYWdlci5hZGRDb250cm9sKGJwbVRleHRCdXR0b24pXG4gICAgICAgICAgICAgICAgYnBtVGV4dEJ1dHRvbi5zY2FsaW5nLnNldCgwLjUsIDAuMiwgMC4xKVxuICAgICAgICAgICAgICAgIGJwbVRleHRCdXR0b24ubm9kZS5pc1BpY2thYmxlID0gZmFsc2VcbiAgICAgICAgICAgICAgICBicG1UZXh0QnV0dG9uLm1lc2gubWF0ZXJpYWwuZGlmZnVzZUNvbG9yLnNldCgwLjc1LCAwLjc1LCAwLjc1KVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9wTGVmdENvbnRyb2woYnBtVGV4dEJ1dHRvbilcblxuICAgICAgICAgICAgICAgIGNvbnN0IGJwbVRleHQgPSBuZXcgQkFCWUxPTi5HVUkuVGV4dEJsb2NrKGBndWkuYnBtLnRleHRgKVxuICAgICAgICAgICAgICAgIGJwbVRleHRCdXR0b24uY29udGVudCA9IGJwbVRleHRcbiAgICAgICAgICAgICAgICBicG1UZXh0LmNvbG9yID0gYHdoaXRlYFxuICAgICAgICAgICAgICAgIGJwbVRleHQuZm9udFNpemUgPSAyNFxuICAgICAgICAgICAgICAgIGJwbVRleHQudGV4dCA9IGAke0JwbURlZmF1bHR9IGJwbWBcbiAgICAgICAgICAgICAgICBicG1UZXh0LnNjYWxlWCA9IDEgLyBicG1UZXh0QnV0dG9uLnNjYWxpbmcueFxuICAgICAgICAgICAgICAgIGJwbVRleHQuc2NhbGVZID0gMSAvIGJwbVRleHRCdXR0b24uc2NhbGluZy55XG4gICAgICAgICAgICAgICAgdGhpcy5icG1UZXh0ID0gYnBtVGV4dFxuXG4gICAgICAgICAgICAgICAgY29uc3QgYnBtU2xpZGVyID0gbmV3IEJBQllMT04uR1VJLlNsaWRlcjNEKGBndWkuYnBtLnNsaWRlcmApXG4gICAgICAgICAgICAgICAgbWFuYWdlci5hZGRDb250cm9sKGJwbVNsaWRlcilcbiAgICAgICAgICAgICAgICBicG1TbGlkZXIucG9zaXRpb24ueiA9IDAuMDY1XG4gICAgICAgICAgICAgICAgYnBtU2xpZGVyLm1pbmltdW0gPSBCcG1NaW5cbiAgICAgICAgICAgICAgICBicG1TbGlkZXIubWF4aW11bSA9IEJwbU1heFxuICAgICAgICAgICAgICAgIGJwbVNsaWRlci52YWx1ZSA9IEJwbURlZmF1bHRcbiAgICAgICAgICAgICAgICBicG1TbGlkZXIub25WYWx1ZUNoYW5nZWRPYnNlcnZhYmxlLmFkZCgodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2V0QnBtKE1hdGgucm91bmQodmFsdWUpKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVVpVGV4dCgpXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvcExlZnRDb250cm9sKGJwbVNsaWRlciwgMC45KVxuICAgICAgICAgICAgICAgIHRoaXMuYnBtU2xpZGVyID0gYnBtU2xpZGVyXG5cbiAgICAgICAgICAgICAgICBjb25zdCBtb2RlQ2FtZXJhQnV0dG9uID0gbmV3IEJBQllMT04uR1VJLkJ1dHRvbjNEKGBndWkubW9kZS5jYW1lcmFCdXR0b25gKVxuICAgICAgICAgICAgICAgIG1hbmFnZXIuYWRkQ29udHJvbChtb2RlQ2FtZXJhQnV0dG9uKVxuICAgICAgICAgICAgICAgIG1vZGVDYW1lcmFCdXR0b24uc2NhbGluZy5zZXQoMC42LCAwLjIsIDAuMSlcbiAgICAgICAgICAgICAgICBtb2RlQ2FtZXJhQnV0dG9uLmNvbnRlbnQgPSBuZXcgQkFCWUxPTi5HVUkuVGV4dEJsb2NrKGBndWkubW9kZS5jYW1lcmFCdXR0b24udGV4dGAsIGBDYW1lcmFgKVxuICAgICAgICAgICAgICAgIG1vZGVDYW1lcmFCdXR0b24uY29udGVudC5jb2xvciA9IGB3aGl0ZWBcbiAgICAgICAgICAgICAgICBtb2RlQ2FtZXJhQnV0dG9uLmNvbnRlbnQuZm9udFNpemUgPSAyNFxuICAgICAgICAgICAgICAgIG1vZGVDYW1lcmFCdXR0b24uY29udGVudC5zY2FsZVggPSAxIC8gbW9kZUNhbWVyYUJ1dHRvbi5zY2FsaW5nLnhcbiAgICAgICAgICAgICAgICBtb2RlQ2FtZXJhQnV0dG9uLmNvbnRlbnQuc2NhbGVZID0gMSAvIG1vZGVDYW1lcmFCdXR0b24uc2NhbGluZy55XG4gICAgICAgICAgICAgICAgbW9kZUNhbWVyYUJ1dHRvbi5vblBvaW50ZXJDbGlja09ic2VydmFibGUuYWRkKCgpID0+IHsgdGhpcy5zd2l0Y2hUb0NhbWVyYU1vZGUoKSB9KVxuICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9wUmlnaHRDb250cm9sKG1vZGVDYW1lcmFCdXR0b24pXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlQ2FtZXJhQnV0dG9uID0gbW9kZUNhbWVyYUJ1dHRvblxuXG4gICAgICAgICAgICAgICAgY29uc3QgbW9kZUVyYXNlQnV0dG9uID0gbmV3IEJBQllMT04uR1VJLkJ1dHRvbjNEKGBndWkubW9kZS5lcmFzZUJ1dHRvbmApXG4gICAgICAgICAgICAgICAgbWFuYWdlci5hZGRDb250cm9sKG1vZGVFcmFzZUJ1dHRvbilcbiAgICAgICAgICAgICAgICBtb2RlRXJhc2VCdXR0b24uc2NhbGluZy5zZXQoMC42LCAwLjIsIDAuMSlcbiAgICAgICAgICAgICAgICBtb2RlRXJhc2VCdXR0b24uY29udGVudCA9IG5ldyBCQUJZTE9OLkdVSS5UZXh0QmxvY2soYGd1aS5tb2RlLmVyYXNlQnV0dG9uLnRleHRgLCBgRXJhc2VgKVxuICAgICAgICAgICAgICAgIG1vZGVFcmFzZUJ1dHRvbi5jb250ZW50LmNvbG9yID0gYHdoaXRlYFxuICAgICAgICAgICAgICAgIG1vZGVFcmFzZUJ1dHRvbi5jb250ZW50LmZvbnRTaXplID0gMjRcbiAgICAgICAgICAgICAgICBtb2RlRXJhc2VCdXR0b24uY29udGVudC5zY2FsZVggPSAxIC8gbW9kZUVyYXNlQnV0dG9uLnNjYWxpbmcueFxuICAgICAgICAgICAgICAgIG1vZGVFcmFzZUJ1dHRvbi5jb250ZW50LnNjYWxlWSA9IDEgLyBtb2RlRXJhc2VCdXR0b24uc2NhbGluZy55XG4gICAgICAgICAgICAgICAgbW9kZUVyYXNlQnV0dG9uLm9uUG9pbnRlckNsaWNrT2JzZXJ2YWJsZS5hZGQoKCkgPT4geyB0aGlzLnN3aXRjaFRvRXJhc2VNb2RlKCkgfSlcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvcFJpZ2h0Q29udHJvbChtb2RlRXJhc2VCdXR0b24pXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlRXJhc2VCdXR0b24gPSBtb2RlRXJhc2VCdXR0b25cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1vZGVEcmF3QnV0dG9uID0gbmV3IEJBQllMT04uR1VJLkJ1dHRvbjNEKGBndWkubW9kZS5kcmF3QnV0dG9uYClcbiAgICAgICAgICAgICAgICBtYW5hZ2VyLmFkZENvbnRyb2wobW9kZURyYXdCdXR0b24pXG4gICAgICAgICAgICAgICAgbW9kZURyYXdCdXR0b24uc2NhbGluZy5zZXQoMC42LCAwLjIsIDAuMSlcbiAgICAgICAgICAgICAgICBtb2RlRHJhd0J1dHRvbi5jb250ZW50ID0gbmV3IEJBQllMT04uR1VJLlRleHRCbG9jayhgZ3VpLm1vZGUuZHJhd0J1dHRvbi50ZXh0YCwgYERyYXdgKVxuICAgICAgICAgICAgICAgIG1vZGVEcmF3QnV0dG9uLmNvbnRlbnQuY29sb3IgPSBgd2hpdGVgXG4gICAgICAgICAgICAgICAgbW9kZURyYXdCdXR0b24uY29udGVudC5mb250U2l6ZSA9IDI0XG4gICAgICAgICAgICAgICAgbW9kZURyYXdCdXR0b24uY29udGVudC5zY2FsZVggPSAxIC8gbW9kZURyYXdCdXR0b24uc2NhbGluZy54XG4gICAgICAgICAgICAgICAgbW9kZURyYXdCdXR0b24uY29udGVudC5zY2FsZVkgPSAxIC8gbW9kZURyYXdCdXR0b24uc2NhbGluZy55XG4gICAgICAgICAgICAgICAgbW9kZURyYXdCdXR0b24ub25Qb2ludGVyQ2xpY2tPYnNlcnZhYmxlLmFkZCgoKSA9PiB7IHRoaXMuc3dpdGNoVG9EcmF3TW9kZSgpIH0pXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRUb3BSaWdodENvbnRyb2wobW9kZURyYXdCdXR0b24pXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlRHJhd0J1dHRvbiA9IG1vZGVEcmF3QnV0dG9uXG5cbiAgICAgICAgICAgICAgICB0aGlzLnN3aXRjaFRvRHJhd01vZGUoKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBicG1TbGlkZXIgPSBudWxsXG4gICAgICAgICAgICBicG1UZXh0ID0gbnVsbFxuICAgICAgICAgICAgbW9kZURyYXdCdXR0b24gPSBudWxsXG4gICAgICAgICAgICBtb2RlRXJhc2VCdXR0b24gPSBudWxsXG4gICAgICAgICAgICBtb2RlQ2FtZXJhQnV0dG9uID0gbnVsbFxuXG4gICAgICAgICAgICBnZXQgeExlZnQoKSB7IHJldHVybiAtQm91bmRzV2lkdGggLyAyIH1cbiAgICAgICAgICAgIGdldCB5VG9wKCkgeyByZXR1cm4gQm91bmRzSGVpZ2h0IC8gMiArIDAuMSB9XG5cbiAgICAgICAgICAgIG1hcmdpbiA9IDAuMDFcbiAgICAgICAgICAgIHhGb3JOZXh0VG9wTGVmdENvbnRyb2wgPSB0aGlzLnhMZWZ0XG4gICAgICAgICAgICB4Rm9yTmV4dFRvcFJpZ2h0Q29udHJvbCA9IHRoaXMueExlZnQgKyBCb3VuZHNXaWR0aFxuXG4gICAgICAgICAgICBtb2RlID0gYGBcblxuICAgICAgICAgICAgYWRkVG9wTGVmdENvbnRyb2wgPSAoY29udHJvbCwgd2lkdGgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAod2lkdGggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gY29udHJvbC5tZXNoXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJvdW5kcyA9IG1lc2guZ2V0Qm91bmRpbmdJbmZvKClcbiAgICAgICAgICAgICAgICAgICAgd2lkdGggPSAoYm91bmRzLm1heGltdW0ueCAtIGJvdW5kcy5taW5pbXVtLngpICogbWVzaC5zY2FsaW5nLnhcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb250cm9sLnBvc2l0aW9uLnggPSB0aGlzLnhGb3JOZXh0VG9wTGVmdENvbnRyb2wgKyB3aWR0aCAvIDJcbiAgICAgICAgICAgICAgICBjb250cm9sLnBvc2l0aW9uLnkgPSB0aGlzLnlUb3BcblxuICAgICAgICAgICAgICAgIHRoaXMueEZvck5leHRUb3BMZWZ0Q29udHJvbCArPSB3aWR0aCArIHRoaXMubWFyZ2luXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFkZFRvcFJpZ2h0Q29udHJvbCA9IChjb250cm9sLCB3aWR0aCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh3aWR0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBjb250cm9sLm1lc2hcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYm91bmRzID0gbWVzaC5nZXRCb3VuZGluZ0luZm8oKVxuICAgICAgICAgICAgICAgICAgICB3aWR0aCA9IChib3VuZHMubWF4aW11bS54IC0gYm91bmRzLm1pbmltdW0ueCkgKiBtZXNoLnNjYWxpbmcueFxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnRyb2wucG9zaXRpb24ueCA9IHRoaXMueEZvck5leHRUb3BSaWdodENvbnRyb2wgLSB3aWR0aCAvIDJcbiAgICAgICAgICAgICAgICBjb250cm9sLnBvc2l0aW9uLnkgPSB0aGlzLnlUb3BcblxuICAgICAgICAgICAgICAgIHRoaXMueEZvck5leHRUb3BSaWdodENvbnRyb2wgLT0gd2lkdGggKyB0aGlzLm1hcmdpblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzd2l0Y2hUb0RyYXdNb2RlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMubW9kZSA9IGBEcmF3TW9kZWBcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVVpVGV4dCgpXG4gICAgICAgICAgICAgICAgY2FtZXJhLmRldGFjaENvbnRyb2woKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzd2l0Y2hUb0VyYXNlTW9kZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGUgPSBgRXJhc2VNb2RlYFxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVWlUZXh0KClcbiAgICAgICAgICAgICAgICBjYW1lcmEuZGV0YWNoQ29udHJvbCgpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHN3aXRjaFRvQ2FtZXJhTW9kZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGUgPSBgQ2FtZXJhTW9kZWBcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVVpVGV4dCgpXG4gICAgICAgICAgICAgICAgY2FtZXJhLmF0dGFjaENvbnRyb2woKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1cGRhdGVVaVRleHQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5icG1TbGlkZXIudmFsdWUgPSBicG1cbiAgICAgICAgICAgICAgICB0aGlzLmJwbVRleHQudGV4dCA9IGAke2JwbX0gYnBtYFxuXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlRHJhd0J1dHRvbi5tZXNoLm1hdGVyaWFsLmRpZmZ1c2VDb2xvci5zZXQoMC41LCAwLjUsIDAuNSlcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVFcmFzZUJ1dHRvbi5tZXNoLm1hdGVyaWFsLmRpZmZ1c2VDb2xvci5zZXQoMC41LCAwLjUsIDAuNSlcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVDYW1lcmFCdXR0b24ubWVzaC5tYXRlcmlhbC5kaWZmdXNlQ29sb3Iuc2V0KDAuNSwgMC41LCAwLjUpXG4gICAgICAgICAgICAgICAgbGV0IGN1cnJlbnRNb2RlQnV0dG9uID0gbnVsbFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1vZGUgPT09IGBEcmF3TW9kZWApIHtcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudE1vZGVCdXR0b24gPSB0aGlzLm1vZGVEcmF3QnV0dG9uXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1vZGUgPT09IGBFcmFzZU1vZGVgKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlQnV0dG9uID0gdGhpcy5tb2RlRXJhc2VCdXR0b25cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubW9kZSA9PT0gYENhbWVyYU1vZGVgKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlQnV0dG9uID0gdGhpcy5tb2RlQ2FtZXJhQnV0dG9uXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlQnV0dG9uLm1lc2gubWF0ZXJpYWwuZGlmZnVzZUNvbG9yLnNldCgwLjksIDAuOSwgMC45KVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8jZW5kcmVnaW9uXG5cbiAgICAvLyNyZWdpb24gUG9pbnRlciBoYW5kbGluZ1xuXG4gICAgY29uc3QgaGl0UG9pbnRQbGFuZUZvckRyYXdpbmcgPSBCQUJZTE9OLk1lc2hCdWlsZGVyLkNyZWF0ZVBsYW5lKGBkcmF3aW5nIHBsYW5lYCwgeyB3aWR0aDogMiAqIEJvdW5kc1dpZHRoLCBoZWlnaHQ6IDIgKiBCb3VuZHNIZWlnaHQgfSlcbiAgICBoaXRQb2ludFBsYW5lRm9yRHJhd2luZy52aXNpYmlsaXR5ID0gMFxuICAgIGxldCBwbGFuZUJlaW5nQWRkZWQgPSBudWxsXG5cbiAgICBjb25zdCBzdGFydEFkZGluZ1BsYW5lID0gKHN0YXJ0UG9pbnQpID0+IHtcbiAgICAgICAgc3RhcnRQb2ludC54ID0gTWF0aC5tYXgoLUhhbGZCb3VuZHNXaWR0aCwgTWF0aC5taW4oc3RhcnRQb2ludC54LCBIYWxmQm91bmRzV2lkdGgpKVxuICAgICAgICBzdGFydFBvaW50LnkgPSBNYXRoLm1heCgtSGFsZkJvdW5kc0hlaWdodCwgTWF0aC5taW4oc3RhcnRQb2ludC55LCBIYWxmQm91bmRzSGVpZ2h0KSlcbiAgICAgICAgc3RhcnRQb2ludC56ID0gMFxuICAgICAgICBwbGFuZUJlaW5nQWRkZWQgPSBuZXcgUGxhbmUoc3RhcnRQb2ludClcbiAgICB9XG5cbiAgICBjb25zdCBmaW5pc2hBZGRpbmdQbGFuZSA9ICgpID0+IHtcbiAgICAgICAgaWYgKHBsYW5lQmVpbmdBZGRlZCkge1xuICAgICAgICAgICAgcGxhbmVCZWluZ0FkZGVkLmZyZWV6ZSgpXG4gICAgICAgIH1cbiAgICAgICAgcGxhbmVCZWluZ0FkZGVkID0gbnVsbFxuICAgIH1cblxuICAgIHNjZW5lLm9uUG9pbnRlck9ic2VydmFibGUuYWRkKChwb2ludGVySW5mbykgPT4ge1xuICAgICAgICBzd2l0Y2ggKHBvaW50ZXJJbmZvLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgQkFCWUxPTi5Qb2ludGVyRXZlbnRUeXBlcy5QT0lOVEVSRE9XTjpcbiAgICAgICAgICAgICAgICBpZiAocG9pbnRlckluZm8ucGlja0luZm8uaGl0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChndWkubW9kZSA9PT0gYERyYXdNb2RlYCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnRBZGRpbmdQbGFuZShwb2ludGVySW5mby5waWNrSW5mby5waWNrZWRQb2ludClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChndWkubW9kZSA9PT0gYEVyYXNlTW9kZWApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBpY2tlZE1lc2ggPSBwb2ludGVySW5mby5waWNrSW5mby5waWNrZWRNZXNoXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoUGxhbmUuUGxhbmVNZXNoTWFwLmhhcyhwaWNrZWRNZXNoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFBsYW5lLlBsYW5lTWVzaE1hcC5nZXQocGlja2VkTWVzaCkuZGlzYWJsZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3VpZGVsaW5lLnVwZGF0ZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICBjYXNlIEJBQllMT04uUG9pbnRlckV2ZW50VHlwZXMuUE9JTlRFUk1PVkU6XG4gICAgICAgICAgICAgICAgaWYgKHBsYW5lQmVpbmdBZGRlZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwaWNrSW5mbyA9IHNjZW5lLnBpY2soc2NlbmUucG9pbnRlclgsIHNjZW5lLnBvaW50ZXJZKVxuICAgICAgICAgICAgICAgICAgICBpZiAocGlja0luZm8uaGl0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwaWNrZWRQb2ludCA9IHBpY2tJbmZvLnBpY2tlZFBvaW50XG4gICAgICAgICAgICAgICAgICAgICAgICBwaWNrZWRQb2ludC54ID0gTWF0aC5tYXgoLUhhbGZCb3VuZHNXaWR0aCwgTWF0aC5taW4ocGlja2VkUG9pbnQueCwgSGFsZkJvdW5kc1dpZHRoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHBpY2tlZFBvaW50LnkgPSBNYXRoLm1heCgtSGFsZkJvdW5kc0hlaWdodCwgTWF0aC5taW4ocGlja2VkUG9pbnQueSwgSGFsZkJvdW5kc0hlaWdodCkpXG4gICAgICAgICAgICAgICAgICAgICAgICBwaWNrZWRQb2ludC56ID0gMFxuICAgICAgICAgICAgICAgICAgICAgICAgcGxhbmVCZWluZ0FkZGVkLmVuZFBvaW50ID0gcGlja2VkUG9pbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIGd1aWRlbGluZS51cGRhdGUoKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgY2FzZSBCQUJZTE9OLlBvaW50ZXJFdmVudFR5cGVzLlBPSU5URVJVUDpcbiAgICAgICAgICAgICAgICBmaW5pc2hBZGRpbmdQbGFuZSgpXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgIH0pXG5cbiAgICAvLyNlbmRyZWdpb25cblxuICAgIC8vI3JlZ2lvbiBYUlxuXG4gICAgY29uc3Qgc3RhcnRYciA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHhyID0gYXdhaXQgc2NlbmUuY3JlYXRlRGVmYXVsdFhSRXhwZXJpZW5jZUFzeW5jKHt9KVxuICAgICAgICAgICAgaWYgKCEheHIgJiYgISF4ci5lbnRlckV4aXRVSSkge1xuICAgICAgICAgICAgICAgIHhyLmVudGVyRXhpdFVJLmFjdGl2ZUJ1dHRvbkNoYW5nZWRPYnNlcnZhYmxlLmFkZCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIEJBQllMT04uRW5naW5lLmF1ZGlvRW5naW5lLnVubG9jaygpXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmRlYnVnKGUpXG4gICAgICAgIH1cbiAgICB9XG4gICAgc3RhcnRYcigpXG5cbiAgICAvLyNlbmRyZWdpb25cblxuICAgIHJldHVybiBzY2VuZVxufVxuXG5mdW5jdGlvbiBpc0luQmFieWxvblBsYXlncm91bmQoKSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZy1yb290JykgIT09IG51bGxcbn1cblxuaWYgKCFpc0luQmFieWxvblBsYXlncm91bmQoKSkge1xuICAgIG1vZHVsZS5leHBvcnRzID0gY3JlYXRlU2NlbmVcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gQkFCWUxPTjsiLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZ2V0RGVmYXVsdEV4cG9ydCBmdW5jdGlvbiBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIG5vbi1oYXJtb255IG1vZHVsZXNcbl9fd2VicGFja19yZXF1aXJlX18ubiA9IChtb2R1bGUpID0+IHtcblx0dmFyIGdldHRlciA9IG1vZHVsZSAmJiBtb2R1bGUuX19lc01vZHVsZSA/XG5cdFx0KCkgPT4gKG1vZHVsZVsnZGVmYXVsdCddKSA6XG5cdFx0KCkgPT4gKG1vZHVsZSk7XG5cdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsIHsgYTogZ2V0dGVyIH0pO1xuXHRyZXR1cm4gZ2V0dGVyO1xufTsiLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLmcgPSAoZnVuY3Rpb24oKSB7XG5cdGlmICh0eXBlb2YgZ2xvYmFsVGhpcyA9PT0gJ29iamVjdCcpIHJldHVybiBnbG9iYWxUaGlzO1xuXHR0cnkge1xuXHRcdHJldHVybiB0aGlzIHx8IG5ldyBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0aWYgKHR5cGVvZiB3aW5kb3cgPT09ICdvYmplY3QnKSByZXR1cm4gd2luZG93O1xuXHR9XG59KSgpOyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgKiBhcyBCQUJZTE9OIGZyb20gJ2JhYnlsb25qcydcblxuY29uc3QgY3JlYXRlU2NlbmUgPSByZXF1aXJlKCcuL3BsYXlncm91bmQuanMnKVxuLy8gY29uc3QgY3JlYXRlU2NlbmUgPSByZXF1aXJlKCcuL3JlZmxlY3Rpb25zLmpzJylcblxuZ2xvYmFsLmNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdjYW52YXMnKVswXVxuZ2xvYmFsLmVuZ2luZSA9IG5ldyBCQUJZTE9OLkVuZ2luZShjYW52YXMsIHRydWUsIHsgYXVkaW9FbmdpbmU6IHRydWUsIGF1ZGlvRW5naW5lT3B0aW9uczoge1xuICAgIGF1ZGlvQ29udGV4dDogbmV3IEF1ZGlvQ29udGV4dFxufX0pXG5cbmNvbnN0IHNjZW5lID0gY3JlYXRlU2NlbmUoKVxuXG5lbmdpbmUucnVuUmVuZGVyTG9vcCgoKSA9PiB7XG4gICAgc2NlbmUucmVuZGVyKCk7XG59KVxuXG5vbnJlc2l6ZSA9ICgpID0+IHtcbiAgICBlbmdpbmUucmVzaXplKClcbn1cbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==